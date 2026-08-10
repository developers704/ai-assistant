import {
  clearMailSession,
  getAccessToken,
  getMailToken,
  getSavedEmail,
  getSavedPassword,
  hasMailSession,
  saveLoginCredentials,
  saveMailToken,
  saveTokens,
} from "@/lib/valliani-mail/session";
import {
  ALL_MAIL_FOLDER,
  STARRED_FOLDER,
  jwtExpiresWithin,
  parseMailAuthUser,
  parseMailFolder,
  parseMailMessage,
  parseMailSummary,
  sortFolders,
  type MailAttachment,
  type MailAuthResponse,
  type MailAuthUser,
  type MailFolder,
  type MailMessage,
  type MailMessagePage,
  type MailSummary,
  asInt,
} from "@/lib/valliani-mail/types";

const PROXY_BASE = "/api/valliani-mail";

let mailTokenRefreshFuture: Promise<void> | null = null;
let reloginFuture: Promise<void> | null = null;

function extractError(status: number, body: string): string {
  try {
    const decoded = JSON.parse(body) as Record<string, unknown>;
    return String(decoded.message ?? decoded.error ?? `Request failed (${status})`);
  } catch {
    return `Request failed (${status})`;
  }
}

function extractLoginError(status: number, body: string): string {
  if (status === 401) return "Incorrect email or password";
  if (status === 429) {
    return "Too many login attempts. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "Mail server is temporarily unavailable. Please try again shortly.";
  }
  return extractError(status, body);
}

function isExpiredMailToken(status: number, body: string): boolean {
  if (status !== 401) return false;
  return extractError(status, body)
    .toLowerCase()
    .includes("invalid or expired mail token");
}

function isExpiredAccessToken(status: number, body: string): boolean {
  if (status !== 401) return false;
  return extractError(status, body)
    .toLowerCase()
    .includes("invalid or expired access token");
}

async function parseMap(res: Response): Promise<Record<string, unknown>> {
  const decoded = (await res.json()) as unknown;
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("Unexpected response format");
  }
  return decoded as Record<string, unknown>;
}

function authHeaders(accessToken?: string | null, mailToken?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (mailToken) headers["x-mail-token"] = mailToken;
  return headers;
}

function proxyUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const clean = path.replace(/^\/+/, "");
  const url = new URL(`${PROXY_BASE}/${clean}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || String(value).trim() === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function refreshMailToken(password?: string): Promise<void> {
  const resolved = password ?? getSavedPassword();
  if (!resolved) throw new Error("Mail password required to refresh token");
  const accessToken = getAccessToken();
  const res = await fetch(proxyUrl("auth/refresh-mail-token"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ password: resolved }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, body));
  const map = JSON.parse(body) as Record<string, unknown>;
  const next = String(map.mailToken ?? "");
  if (!next) throw new Error("Invalid refresh-mail-token response");
  saveMailToken(next);
}

async function refreshMailTokenOnce(): Promise<void> {
  if (mailTokenRefreshFuture) return mailTokenRefreshFuture;
  const task = refreshMailToken().finally(() => {
    if (mailTokenRefreshFuture === task) mailTokenRefreshFuture = null;
  });
  mailTokenRefreshFuture = task;
  return task;
}

async function reloginWithSavedCredentials(): Promise<void> {
  const email = getSavedEmail();
  const password = getSavedPassword();
  if (!email || !password) {
    throw new Error("Session expired — please log in again");
  }
  await login({ email, password });
}

async function reloginOnce(): Promise<void> {
  if (reloginFuture) return reloginFuture;
  const task = reloginWithSavedCredentials().finally(() => {
    if (reloginFuture === task) reloginFuture = null;
  });
  reloginFuture = task;
  return task;
}

async function mailRequest(
  builder: (accessToken: string | null, mailToken: string | null) => Promise<Response>
): Promise<Response> {
  let accessToken = getAccessToken();
  let mailToken = getMailToken();
  let response = await builder(accessToken, mailToken);
  let body = await response.clone().text();

  if (isExpiredAccessToken(response.status, body)) {
    try {
      await reloginOnce();
    } catch (err) {
      clearMailSession();
      throw err;
    }
    accessToken = getAccessToken();
    mailToken = getMailToken();
    response = await builder(accessToken, mailToken);
    body = await response.clone().text();
  }

  if (isExpiredMailToken(response.status, body)) {
    try {
      await refreshMailTokenOnce();
    } catch (err) {
      clearMailSession();
      throw err;
    }
    accessToken = getAccessToken();
    mailToken = getMailToken();
    response = await builder(accessToken, mailToken);
  }

  return response;
}

export async function ensureMailTokenFresh(
  thresholdMs = 2 * 60 * 1000
): Promise<void> {
  if (jwtExpiresWithin(getMailToken(), thresholdMs)) {
    await refreshMailTokenOnce();
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<MailAuthResponse> {
  const res = await fetch(proxyUrl("auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(extractLoginError(res.status, body));
  const map = JSON.parse(body) as Record<string, unknown>;
  const accessToken = String(map.accessToken ?? map.token ?? "");
  const mailToken = String(map.mailToken ?? "");
  if (!accessToken || !mailToken) throw new Error("Invalid login response");
  const user = parseMailAuthUser(map);
  saveTokens(accessToken, mailToken);
  saveLoginCredentials(input.email, input.password);
  return { accessToken, mailToken, user };
}

export async function me(): Promise<MailAuthUser> {
  const res = await fetch(proxyUrl("auth/me"), {
    headers: authHeaders(getAccessToken()),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, body));
  return parseMailAuthUser(JSON.parse(body) as Record<string, unknown>);
}

export async function logoutMail(): Promise<void> {
  clearMailSession();
}

export { hasMailSession };

export async function getFolders(): Promise<MailFolder[]> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/folders"), { headers: authHeaders(access, mail) })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
  const map = JSON.parse(text) as Record<string, unknown>;
  const folders = ((map.folders as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map(parseMailFolder);
  return sortFolders(folders);
}

export function withAllMailFolder(folders: MailFolder[]): MailFolder[] {
  const filtered = folders.filter((folder) => {
    const path = folder.path.toLowerCase();
    return (
      path !== ALL_MAIL_FOLDER &&
      path !== "all mail" &&
      !path.endsWith("/all mail") &&
      !path.endsWith("\\all mail")
    );
  });
  return [
    ...filtered,
    {
      path: ALL_MAIL_FOLDER,
      name: "All Mail",
      listed: true,
      subscribed: false,
    },
    {
      path: STARRED_FOLDER,
      name: "Favorites",
      listed: true,
      subscribed: false,
    },
  ];
}

export async function getMailboxSummary(): Promise<MailSummary> {
  await ensureMailTokenFresh();
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/summary"), { headers: authHeaders(access, mail) })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
  return parseMailSummary(JSON.parse(text) as Record<string, unknown>);
}

function compareMessagesNewestFirst(a: MailMessage, b: MailMessage): number {
  const ad = a.date ? Date.parse(a.date) : 0;
  const bd = b.date ? Date.parse(b.date) : 0;
  if (bd !== ad) return bd - ad;
  return b.uid - a.uid;
}

export async function getMessagePage(input: {
  folder: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  search?: string;
}): Promise<MailMessagePage> {
  const folder = input.folder;
  const limit = input.limit ?? 80;
  const offset = input.offset ?? 0;

  if (folder === STARRED_FOLDER) {
    const messages = await getStarredMessages(limit);
    return {
      messages,
      total: messages.length,
      offset: 0,
      limit,
      hasMore: false,
    };
  }

  const path = folder === ALL_MAIL_FOLDER ? "mail/all" : "mail/messages";
  const query: Record<string, string | number | boolean | undefined> = {
    limit,
    offset,
    search: input.search?.trim() || undefined,
  };
  if (folder !== ALL_MAIL_FOLDER) {
    query.folder = folder;
    if (input.unreadOnly) query.unread = true;
  }

  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl(path, query), { headers: authHeaders(access, mail) })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
  const map = JSON.parse(text) as Record<string, unknown>;
  const messages = ((map.messages as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => parseMailMessage(e))
    .sort(compareMessagesNewestFirst);
  return {
    messages,
    total: asInt(map.total ?? map.count),
    offset: asInt(map.offset),
    limit: asInt(map.limit ?? limit),
    hasMore: map.hasMore === true,
  };
}

async function getStarredMessages(limit = 100): Promise<MailMessage[]> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/starred", { limit }), {
      headers: authHeaders(access, mail),
    })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
  const map = JSON.parse(text) as Record<string, unknown>;
  return ((map.messages as unknown[]) ?? [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => parseMailMessage(e))
    .sort(compareMessagesNewestFirst);
}

export async function getMessage(input: {
  folder: string;
  uid: number;
}): Promise<MailMessage> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl(`mail/messages/${input.uid}`, { folder: input.folder }), {
      headers: authHeaders(access, mail),
    })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
  return parseMailMessage(JSON.parse(text) as Record<string, unknown>, {
    hydrated: true,
  });
}

export async function getContactSuggestions(query = ""): Promise<string[]> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/contacts", { q: query, query }), {
      headers: authHeaders(access, mail),
    })
  );
  if (!res.ok) return [];
  const map = await parseMap(res);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of (map.contacts ?? map.suggestions ?? []) as unknown[]) {
    let label = "";
    let emailKey = "";
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const email = String(o.email ?? o.address ?? "")
        .trim()
        .toLowerCase();
      const name = String(o.name ?? "").trim();
      const rawLabel = String(o.label ?? "").trim();
      label =
        rawLabel ||
        (name && email ? `${name} <${email}>` : email || String(o.label ?? ""));
      emailKey = email || label.toLowerCase();
    } else {
      label = String(item ?? "").trim();
      emailKey = label.toLowerCase();
    }
    if (!label || seen.has(emailKey)) continue;
    seen.add(emailKey);
    out.push(label);
  }
  return out;
}

export async function sendMail(input: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: MailAttachment[];
  inReplyTo?: string;
  references?: string[];
  composeMode?: string;
  replyToUid?: number;
  replyToFolder?: string;
}): Promise<void> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/send"), {
      method: "POST",
      headers: authHeaders(access, mail),
      body: JSON.stringify({
        to: input.to.join(", "),
        ...(input.cc?.length ? { cc: input.cc.join(", ") } : {}),
        ...(input.bcc?.length ? { bcc: input.bcc.join(", ") } : {}),
        subject: input.subject,
        text: input.body,
        ...(input.html ? { html: input.html } : {}),
        ...(input.inReplyTo?.trim() ? { inReplyTo: input.inReplyTo } : {}),
        ...(input.references?.length ? { references: input.references } : {}),
        ...(input.composeMode?.trim()
          ? { composeMode: input.composeMode }
          : {}),
        ...(input.replyToUid && input.replyToUid > 0
          ? { replyToUid: input.replyToUid }
          : {}),
        ...(input.replyToFolder?.trim()
          ? { replyToFolder: input.replyToFolder }
          : {}),
        attachmentSharing: { expiresIn: "never" },
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                ...(a.contentBase64
                  ? { base64: a.contentBase64, content: a.contentBase64 }
                  : {}),
                ...(a.contentType ? { contentType: a.contentType } : {}),
                ...(a.size != null ? { size: a.size } : {}),
              })),
            }
          : {}),
      }),
    })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
}

export async function saveDraft(input: {
  uid?: number;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
}): Promise<void> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/drafts"), {
      method: "POST",
      headers: authHeaders(access, mail),
      body: JSON.stringify({
        ...(input.uid != null ? { uid: input.uid } : {}),
        to: (input.to ?? []).join(", "),
        ...(input.cc?.length ? { cc: input.cc.join(", ") } : {}),
        ...(input.bcc?.length ? { bcc: input.bcc.join(", ") } : {}),
        subject: input.subject ?? "",
        text: input.body ?? "",
      }),
    })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
}

async function postBulkAction(
  path: string,
  uids: number[],
  bodyFor: (uid: number, all: number[]) => Record<string, unknown>
): Promise<void> {
  const ids = uids.filter((uid) => uid > 0);
  if (!ids.length) return;

  const post = async (batch: number[]) =>
    mailRequest((access, mail) =>
      fetch(proxyUrl(path), {
        method: "POST",
        headers: authHeaders(access, mail),
        body: JSON.stringify(bodyFor(batch[0]!, batch)),
      })
    );

  const first = await post(ids);
  const text = await first.text();
  if (!first.ok) throw new Error(extractError(first.status, text));

  let handled = 1;
  try {
    const decoded = JSON.parse(text) as Record<string, unknown>;
    if (typeof decoded.count === "number") handled = decoded.count;
  } catch {
    /* older APIs only honor uid */
  }
  const remaining = ids.slice(handled);
  for (let i = 0; i < remaining.length; i += 4) {
    const chunk = remaining.slice(i, i + 4);
    await Promise.all(
      chunk.map(async (uid) => {
        const res = await post([uid]);
        if (!res.ok) {
          throw new Error(extractError(res.status, await res.text()));
        }
      })
    );
  }
}

export async function updateMessageFlags(input: {
  folder: string;
  uids: number[];
  action: "add" | "remove" | "set";
  flag: string;
}): Promise<void> {
  await postBulkAction("mail/messages/flags", input.uids, (uid, all) => ({
    folder: input.folder,
    uid,
    uids: all,
    action: input.action,
    flag: input.flag,
  }));
}

export async function moveMessages(input: {
  sourceFolder: string;
  uids: number[];
  targetFolder: string;
}): Promise<void> {
  await postBulkAction("mail/messages/move", input.uids, (uid, all) => ({
    sourceFolder: input.sourceFolder,
    uid,
    uids: all,
    targetFolder: input.targetFolder,
  }));
}

export async function archiveMessages(input: {
  sourceFolder: string;
  uids: number[];
}): Promise<void> {
  await postBulkAction("mail/messages/archive", input.uids, (uid, all) => ({
    sourceFolder: input.sourceFolder,
    uid,
    uids: all,
  }));
}

export async function spamMessages(input: {
  sourceFolder: string;
  uids: number[];
}): Promise<void> {
  await postBulkAction("mail/messages/spam", input.uids, (uid, all) => ({
    sourceFolder: input.sourceFolder,
    uid,
    uids: all,
  }));
}

export async function deleteMessages(input: {
  folder: string;
  uids: number[];
}): Promise<void> {
  await postBulkAction("mail/messages/delete", input.uids, (uid, all) => ({
    folder: input.folder,
    uid,
    uids: all,
  }));
}

export async function forwardMessage(input: {
  folder: string;
  uid: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  note?: string;
}): Promise<void> {
  const res = await mailRequest((access, mail) =>
    fetch(proxyUrl("mail/messages/forward"), {
      method: "POST",
      headers: authHeaders(access, mail),
      body: JSON.stringify({
        folder: input.folder,
        uid: input.uid,
        to: input.to.join(", "),
        ...(input.cc?.length ? { cc: input.cc.join(", ") } : {}),
        ...(input.bcc?.length ? { bcc: input.bcc.join(", ") } : {}),
        text: input.note ?? "",
      }),
    })
  );
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(res.status, text));
}

/** Exported for self-check scripts. */
export const __testables = {
  folderProxyBase: PROXY_BASE,
  jwtExpiresWithin,
  extractLoginError,
};
