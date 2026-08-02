"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { Button } from "@/components/ui/Button";
import { cn, getDisplayFirstName } from "@/lib/utils";
import { bodyMentionsAttachment, sortEmails } from "@/lib/email-utils";
import { syncUiSelection } from "@/components/layout/UiContextSync";
import type { Email } from "@/types";
import { EmailSidebar, type EmailNavId } from "@/components/email/EmailSidebar";
import { EmailThreadList } from "@/components/email/EmailThreadList";
import { EmailReadingPane } from "@/components/email/EmailReadingPane";
import {
  ComposePanel,
  type ComposeState,
} from "@/components/email/ComposePanel";
import {
  withInboxBucket,
  bucketLabel,
  type InboxBucket,
  type MailFolder,
} from "@/lib/email-buckets";
import { Link2, Loader2, Menu, PenSquare, Search } from "lucide-react";
import {
  collectRecipientsFromContacts,
  collectRecipientsFromEmails,
  loadStoredRecipients,
  mergeRecipientSuggestions,
  rememberRecipients,
} from "@/lib/email-recipients";
import {
  VOICE_COMPOSE_STORAGE_KEY,
  type VoiceComposePayload,
} from "@/lib/ai/email-compose";
import { RealtimeVoiceButton } from "@/components/voice/RealtimeVoiceButton";

const MOBILE_HEIGHT = "h-full max-h-full";

function dedupeEmails(emails: Email[]): Email[] {
  const seen = new Set<string>();
  return emails.filter((e) => {
    const key = e.threadId || e.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isFolder(id: EmailNavId): id is MailFolder {
  return id === "inbox" || id === "starred" || id === "sent" || id === "drafts";
}

function isBucket(id: EmailNavId): id is InboxBucket {
  return (
    id === "to_respond" ||
    id === "fyi" ||
    id === "meeting" ||
    id === "marketing" ||
    id === "purchases" ||
    id === "travel"
  );
}

function navTitle(id: EmailNavId): string {
  if (isFolder(id)) {
    return (
      { inbox: "Inbox", starred: "Starred", sent: "Sent", drafts: "Drafts" } as const
    )[id];
  }
  return bucketLabel(id);
}

function composeHasContent(c: ComposeState): boolean {
  return !!(
    c.to.trim() ||
    c.cc?.trim() ||
    c.bcc?.trim() ||
    c.subject.trim() ||
    c.body.trim() ||
    (c.attachments && c.attachments.length > 0)
  );
}

const LOCAL_DRAFTS_KEY = "alexa-email-local-drafts";

type LocalDraft = ComposeState & { id: string; updatedAt: string };

function readLocalDrafts(): LocalDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDrafts(drafts: LocalDraft[]) {
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
}

function localDraftToEmail(d: LocalDraft): Email {
  return {
    id: d.id,
    threadId: d.threadId || d.id,
    draftId: d.id,
    from: d.to.trim() || "(No recipient)",
    fromEmail: d.to,
    to: d.to,
    subject: d.subject.trim() || "(No subject)",
    preview: d.body.slice(0, 140),
    body: d.body,
    receivedAt: d.updatedAt,
    isImportant: false,
    isRead: true,
    needsReply: false,
    category: "normal",
    inboxBucket: "fyi",
    messageCount: 1,
  };
}

export default function EmailPage() {
  const { state, refresh } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nav, setNav] = useState<EmailNavId>("inbox");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [folderEmails, setFolderEmails] = useState<Email[]>([]);
  /** Last loaded Inbox page — triage buckets filter this (not the tiny /api/state sync). */
  const [inboxCache, setInboxCache] = useState<Email[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [markedRead, setMarkedRead] = useState<Set<string>>(new Set());
  /** Live thread updates after send (keeps reading pane in sync without full reload). */
  const [threadOverrides, setThreadOverrides] = useState<Record<string, Email>>(
    {}
  );
  const openedPendingComposeId = useRef<string | null>(null);

  const googleConnected = state?.integrations?.google?.connected ?? false;

  const inboxEmails = useMemo(() => {
    if (!state) return [];
    return sortEmails(dedupeEmails(state.emails.map(withInboxBucket)));
  }, [state]);

  const recipientSuggestions = useMemo(() => {
    const fromMail = collectRecipientsFromEmails([
      ...inboxEmails,
      ...folderEmails,
    ]);
    const fromContacts = collectRecipientsFromContacts(state?.contacts ?? []);
    const stored =
      typeof window !== "undefined" ? loadStoredRecipients() : [];
    return mergeRecipientSuggestions(stored, fromMail, fromContacts);
  }, [inboxEmails, folderEmails, state?.contacts]);

  useEffect(() => {
    const fromMail = collectRecipientsFromEmails([
      ...inboxEmails,
      ...folderEmails,
    ]);
    const fromContacts = collectRecipientsFromContacts(state?.contacts ?? []);
    if (fromMail.length || fromContacts.length) {
      rememberRecipients(mergeRecipientSuggestions(fromMail, fromContacts));
    }
  }, [inboxEmails, folderEmails, state?.contacts]);

  const loadFolder = useCallback(
    async (folder: MailFolder, pageToken?: string, append = false) => {
      if (!googleConnected) {
        if (folder === "drafts") {
          setFolderEmails(readLocalDrafts().map(localDraftToEmail));
          setNextPageToken(undefined);
        } else {
          setFolderEmails([]);
        }
        return;
      }
      if (append) setLoadingMore(true);
      else setLoadingList(true);
      try {
        const qs = new URLSearchParams({
          maxResults: "25",
          folder,
        });
        if (pageToken) qs.set("pageToken", pageToken);
        const res = await fetch(`/api/gmail?${qs}`, { cache: "no-store" });
        const data = await res.json();
        const list = Array.isArray(data.emails)
          ? folder === "drafts"
            ? data.emails
            : data.emails.map((e: Email) => withInboxBucket(e))
          : [];
        setFolderEmails((prev) =>
          append ? dedupeEmails([...prev, ...list]) : list
        );
        if (folder === "inbox") {
          setInboxCache((prev) =>
            append ? dedupeEmails([...prev, ...list]) : list
          );
        }
        setNextPageToken(data.nextPageToken ?? undefined);
      } finally {
        setLoadingList(false);
        setLoadingMore(false);
      }
    },
    [googleConnected]
  );

  useEffect(() => {
    if (isFolder(nav)) {
      // Save open compose before leaving current view
      if (compose && composeHasContent(compose)) {
        void saveDraftOnClose(compose);
      } else {
        setCompose(null);
      }
      void loadFolder(nav);
      setSelectedId(null);
      return;
    }
    if (isBucket(nav)) {
      // Keep inbox cache — do NOT clear. Load inbox once if triage has nothing yet.
      setSelectedId(null);
      if (googleConnected && inboxCache.length === 0) {
        void loadFolder("inbox");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on nav change
  }, [nav, loadFolder]);

  useEffect(() => {
    void syncUiSelection({ selectedEmailId: selectedId ?? undefined });
  }, [selectedId]);

  /** Inbox source for triage + counts (prefer live Gmail page over state sync). */
  const triageSource = useMemo(() => {
    const raw =
      inboxCache.length > 0
        ? inboxCache
        : folderEmails.length > 0 && (nav === "inbox" || isBucket(nav))
          ? folderEmails
          : inboxEmails;
    return dedupeEmails(raw.map((e) => withInboxBucket(e)));
  }, [inboxCache, folderEmails, inboxEmails, nav]);

  const listEmails = useMemo(() => {
    let list: Email[];
    if (isBucket(nav)) {
      list = triageSource.filter((e) => e.inboxBucket === nav);
    } else if (nav === "inbox") {
      list =
        googleConnected && folderEmails.length > 0 ? folderEmails : inboxEmails;
    } else {
      list = folderEmails;
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.from.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q) ||
          e.fromEmail.toLowerCase().includes(q)
      );
    }
    return sortEmails(
      list.map((e) => {
        const live = threadOverrides[e.threadId];
        const base = live ?? e;
        // Sent / drafts shouldn't show AI triage tags
        if (nav === "sent" || nav === "drafts") {
          return { ...base, inboxBucket: undefined, needsReply: false };
        }
        return withInboxBucket(base);
      })
    );
  }, [
    nav,
    inboxEmails,
    folderEmails,
    triageSource,
    query,
    googleConnected,
    threadOverrides,
  ]);

  const counts = useMemo(() => {
    const triage = triageSource;
    return {
      inbox:
        inboxCache.length > 0
          ? inboxCache.length
          : nav === "inbox" && folderEmails.length > 0
            ? folderEmails.length
            : inboxEmails.length,
      starred:
        nav === "starred"
          ? folderEmails.length
          : triage.filter((e) => e.isStarred).length,
      sent: nav === "sent" ? folderEmails.length : undefined,
      drafts: nav === "drafts" ? folderEmails.length : undefined,
      to_respond: triage.filter((e) => e.inboxBucket === "to_respond").length,
      fyi: triage.filter((e) => e.inboxBucket === "fyi").length,
      meeting: triage.filter((e) => e.inboxBucket === "meeting").length,
      marketing: triage.filter((e) => e.inboxBucket === "marketing").length,
      purchases: triage.filter((e) => e.inboxBucket === "purchases").length,
      travel: triage.filter((e) => e.inboxBucket === "travel").length,
    };
  }, [triageSource, inboxCache, folderEmails, inboxEmails, nav]);

  const selected =
    listEmails.find((e) => e.id === selectedId || e.threadId === selectedId) ??
    listEmails.find((e) =>
      e.threadMessages?.some((m) => m.id === selectedId)
    ) ??
    null;

  const mobileReading = !!selectedId;
  const showTriage = nav === "inbox" || isBucket(nav);
  const showFilterTabs = nav === "inbox" || isBucket(nav);

  // List uses lightweight metadata — load full HTML body when opening a thread
  useEffect(() => {
    if (!selected?.threadId || !googleConnected) return;
    void refreshThread(selected.threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open only
  }, [selected?.threadId, googleConnected]);

  // Mark read when opening
  useEffect(() => {
    if (!selected || !googleConnected) return;
    if (selected.isRead) return;
    const tid = selected.threadId;
    if (markedRead.has(tid)) return;
    setMarkedRead((s) => new Set(s).add(tid));
    void fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", threadId: tid }),
    });
    const mark = (prev: Email[]) =>
      prev.map((e) => (e.threadId === tid ? { ...e, isRead: true } : e));
    setFolderEmails(mark);
    setInboxCache(mark);
  }, [selected, googleConnected, markedRead]);

  // Auto AI draft when opening To Respond
  useEffect(() => {
    if (!selected || compose) return;
    if (selected.inboxBucket !== "to_respond") return;
    // Soft prompt: open compose empty with AI ready — user clicks AI Draft or we auto-fill once
  }, [selected, compose]);

  const openReply = async (email: Email, mode: "reply" | "followup" = "reply") => {
    const latest =
      email.threadMessages?.[email.threadMessages.length - 1] ?? email;
    const subject = email.subject.toLowerCase().startsWith("re:")
      ? email.subject
      : `Re: ${email.subject}`;
    setComposeError(null);
    setCompose({
      mode,
      to: latest.fromEmail || email.fromEmail,
      cc: "",
      bcc: "",
      subject,
      body: "",
      threadId: email.threadId,
      inReplyTo: latest.rfcMessageId,
      references: [latest.references, latest.rfcMessageId].filter(Boolean).join(" "),
    });
    // Auto-generate AI draft as soon as reply opens
    setDrafting(true);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: email.threadId,
          emailId: email.id,
          mode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setCompose((c) =>
          c
            ? {
                ...c,
                body: data.draft,
                to: data.to || c.to,
                subject: data.subject || c.subject,
                inReplyTo: data.inReplyTo || c.inReplyTo,
                references: data.references || c.references,
              }
            : c
        );
      } else if (!res.ok) {
        setComposeError(data.error || "Draft failed");
      }
    } catch {
      setComposeError("Draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const openForward = (email: Email) => {
    const latest =
      email.threadMessages?.[email.threadMessages.length - 1] ?? email;
    const subject = /^(fwd|fw):/i.test(email.subject)
      ? email.subject
      : `Fwd: ${email.subject}`;
    const quoted =
      latest.body?.trim() ||
      latest.preview ||
      "(No content)";
    setComposeError(null);
    setCompose({
      mode: "forward",
      to: "",
      cc: "",
      bcc: "",
      subject,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${latest.from} <${latest.fromEmail}>\nDate: ${new Date(latest.receivedAt).toLocaleString()}\nSubject: ${email.subject}\nTo: ${latest.to || "me"}\n\n${quoted}`,
    });
  };

  const openComposeNew = () => {
    setComposeError(null);
    setCompose({
      mode: "compose",
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    });
  };

  const openComposeFromPayload = useCallback((payload: VoiceComposePayload) => {
    setComposeError(null);
    setCompose({
      mode: "compose",
      to: payload.to,
      cc: "",
      bcc: "",
      subject: payload.subject,
      body: payload.body,
    });
  }, []);

  // Voice / chat handoff: sessionStorage compose draft
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(VOICE_COMPOSE_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(VOICE_COMPOSE_STORAGE_KEY);
      const parsed = JSON.parse(raw) as VoiceComposePayload;
      if (parsed?.to || parsed?.subject || parsed?.body) {
        openComposeFromPayload(parsed);
        void refresh();
      }
    } catch {
      // ignore
    }
  }, [openComposeFromPayload, refresh]);

  // Pending email with openCompose (after chat compose_email_to + navigate)
  useEffect(() => {
    const pending = state?.pendingActions?.find(
      (a) => a.type === "email" && a.payload?.openCompose === true
    );
    if (!pending || openedPendingComposeId.current === pending.id) return;
    openedPendingComposeId.current = pending.id;
    const name = pending.payload.to_name
      ? String(pending.payload.to_name)
      : "";
    const email = String(pending.payload.to ?? "");
    const to = name && email ? `${name} <${email}>` : email || name;
    openComposeFromPayload({
      to,
      subject: String(pending.payload.subject ?? ""),
      body: String(pending.payload.body ?? pending.preview ?? ""),
      toName: name || undefined,
    });
  }, [state?.pendingActions, openComposeFromPayload]);

  const saveDraftOnClose = async (c: ComposeState) => {
    if (!composeHasContent(c)) {
      setCompose(null);
      setComposeError(null);
      return;
    }

    if (!googleConnected) {
      const id = c.draftId || `local-${Date.now()}`;
      const next: LocalDraft = {
        ...c,
        id,
        draftId: id,
        updatedAt: new Date().toISOString(),
      };
      const others = readLocalDrafts().filter((d) => d.id !== id);
      writeLocalDrafts([next, ...others]);
      setCompose(null);
      setComposeError(null);
      if (nav === "drafts") {
        setFolderEmails(readLocalDrafts().map(localDraftToEmail));
      }
      return;
    }

    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          to: c.to,
          cc: c.cc,
          bcc: c.bcc,
          subject: c.subject || "(No subject)",
          body: c.body,
          threadId: c.threadId,
          draftId: c.draftId,
          inReplyTo: c.inReplyTo,
          references: c.references,
          attachments: (c.attachments ?? []).map((a) => ({
            filename: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = String(data.error || "");
        // Old Google tokens lack gmail.compose — fall back to local Drafts so Close still works
        if (/insufficient.*(auth|scope)/i.test(msg) || /scope/i.test(msg)) {
          const id = c.draftId || `local-${Date.now()}`;
          const next: LocalDraft = {
            ...c,
            id,
            draftId: id,
            updatedAt: new Date().toISOString(),
          };
          const others = readLocalDrafts().filter((d) => d.id !== id);
          writeLocalDrafts([next, ...others]);
          setCompose(null);
          setComposeError(null);
          if (nav === "drafts") {
            setFolderEmails(readLocalDrafts().map(localDraftToEmail));
          }
          return;
        }
        setComposeError(
          msg || "Could not save draft. Reconnect Google in Settings if this persists."
        );
        return;
      }
      setCompose(null);
      setComposeError(null);
      if (nav === "drafts") void loadFolder("drafts");
    } catch {
      setComposeError("Could not save draft");
    }
  };

  const openDraft = (email: Email) => {
    setSelectedId(null);
    setComposeError(null);
    setCompose({
      mode: email.threadId && email.inReplyTo ? "reply" : "compose",
      to: email.to || email.fromEmail || "",
      cc: email.cc || "",
      bcc: email.bcc || "",
      subject: email.subject.startsWith("Re:")
        ? email.subject
        : email.subject || "",
      body: email.body || "",
      threadId: email.threadId,
      draftId: email.draftId,
      inReplyTo: email.rfcMessageId,
      references: email.references,
    });
  };

  const closeCompose = () => {
    if (!compose) return;
    void saveDraftOnClose(compose);
  };

  const runThreadAction = async (
    email: Email,
    action: "star" | "unstar" | "archive" | "trash" | "mark_read" | "mark_unread"
  ) => {
    if (!googleConnected) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, threadId: email.threadId }),
      });
      if (!res.ok) return;
      if (action === "archive" || action === "trash") {
        setFolderEmails((prev) =>
          prev.filter((e) => e.threadId !== email.threadId)
        );
        setInboxCache((prev) =>
          prev.filter((e) => e.threadId !== email.threadId)
        );
        setSelectedId(null);
        setCompose(null);
        return;
      }
      setFolderEmails((prev) =>
        prev.map((e) => {
          if (e.threadId !== email.threadId) return e;
          if (action === "star") return { ...e, isStarred: true, isImportant: true };
          if (action === "unstar") return { ...e, isStarred: false };
          if (action === "mark_read") return { ...e, isRead: true };
          if (action === "mark_unread") return { ...e, isRead: false };
          return e;
        })
      );
    } finally {
      setActionBusy(false);
    }
  };

  const applyThreadUpdate = useCallback((email: Email) => {
    const tid = email.threadId;
    const patched = withInboxBucket(email);
    setThreadOverrides((prev) => ({ ...prev, [tid]: patched }));
    const patchList = (prev: Email[]) => {
      const idx = prev.findIndex((e) => e.threadId === tid);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = patched;
      return next;
    };
    setFolderEmails(patchList);
    setInboxCache(patchList);
  }, []);

  const appendOptimisticSent = useCallback(
    (c: ComposeState, messageId?: string) => {
      const tid = c.threadId;
      if (!tid) return;
      const existing =
        threadOverrides[tid] ||
        listEmails.find((e) => e.threadId === tid) ||
        null;
      if (!existing) return;

      const now = new Date().toISOString();
      const meName = state?.user?.name?.trim() || "You";
      const meEmail = state?.user?.email?.trim() || "";
      const sentMsg: Email = {
        id: messageId || `sent-${Date.now()}`,
        threadId: tid,
        from: meName,
        fromEmail: meEmail,
        to: c.to,
        cc: c.cc,
        subject: c.subject,
        preview: c.body.slice(0, 140),
        body: c.body,
        receivedAt: now,
        isImportant: false,
        isRead: true,
        isStarred: false,
        needsReply: false,
        category: "normal",
        messageCount: 1,
      };

      const prior =
        existing.threadMessages && existing.threadMessages.length > 0
          ? existing.threadMessages.map(
              ({ threadMessages: _t, ...rest }) => rest
            )
          : [
              (() => {
                const { threadMessages: _t, ...rest } = existing;
                return rest;
              })(),
            ];

      // Avoid duplicate if we already have this message id
      if (prior.some((m) => m.id === sentMsg.id)) return;

      const threadMessages = [...prior, sentMsg];
      applyThreadUpdate(
        withInboxBucket({
          ...existing,
          // Keep list selection id stable; show latest message in the row
          from: sentMsg.from,
          fromEmail: sentMsg.fromEmail,
          preview: sentMsg.preview,
          body: sentMsg.body,
          bodyHtml: undefined,
          attachments: undefined,
          receivedAt: now,
          isRead: true,
          needsReply: false,
          threadMessages,
          messageCount: threadMessages.length,
        })
      );
    },
    [
      applyThreadUpdate,
      listEmails,
      state?.user?.email,
      state?.user?.name,
      threadOverrides,
    ]
  );

  const refreshThread = useCallback(
    async (threadId: string) => {
      if (!googleConnected || !threadId) return;
      try {
        const res = await fetch(
          `/api/gmail?threadId=${encodeURIComponent(threadId)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok && data.email) {
          applyThreadUpdate(data.email as Email);
        }
      } catch {
        // keep optimistic view
      }
    },
    [applyThreadUpdate, googleConnected]
  );

  const sendCompose = async () => {
    if (!compose) return;
    const snapshot = compose;
    if (!snapshot.subject.trim()) {
      setComposeError("Add a subject before sending.");
      return;
    }
    if (
      !(snapshot.attachments ?? []).length &&
      bodyMentionsAttachment(snapshot.body)
    ) {
      setComposeError(
        "You mentioned an attachment — attach a file before sending."
      );
      return;
    }
    setSending(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to: snapshot.to,
          cc: snapshot.cc,
          bcc: snapshot.bcc,
          subject: snapshot.subject,
          body: snapshot.body,
          threadId: snapshot.threadId,
          inReplyTo: snapshot.inReplyTo,
          references: snapshot.references,
          draftId: snapshot.draftId,
          attachments: (snapshot.attachments ?? []).map((a) => ({
            filename: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error || "Send failed");
        return;
      }
      if (!googleConnected && snapshot.draftId) {
        writeLocalDrafts(
          readLocalDrafts().filter((d) => d.id !== snapshot.draftId)
        );
      }

      const tid = snapshot.threadId || data.threadId;
      rememberRecipients(
        collectRecipientsFromEmails([
          {
            id: "sent-local",
            threadId: tid || "sent-local",
            from: "",
            fromEmail: "",
            to: snapshot.to,
            cc: snapshot.cc,
            bcc: snapshot.bcc,
            subject: snapshot.subject,
            preview: "",
            body: "",
            receivedAt: new Date().toISOString(),
            isImportant: false,
            isRead: true,
            needsReply: false,
            category: "normal",
          },
        ])
      );
      setCompose(null);
      // Clear voice/chat pending so "send" confirm can't double-send
      void fetch("/api/pending-action", { method: "DELETE" }).then(() =>
        refresh()
      );

      // Show the sent message in the thread immediately, then sync from Gmail
      if (tid) {
        appendOptimisticSent(snapshot, data.messageId);
      }
      if (data.email) {
        applyThreadUpdate(data.email as Email);
      } else if (tid) {
        void refreshThread(String(tid));
      }

      if (nav === "drafts") void loadFolder("drafts");
    } catch {
      setComposeError("Send failed");
    } finally {
      setSending(false);
    }
  };

  const aiDraft = async () => {
    if (!compose) return;
    const isNewMail =
      compose.mode === "compose" || compose.mode === "forward";

    if (isNewMail) {
      if (!compose.body.trim()) {
        setComposeError("Write a rough message first, then use AI Draft");
        return;
      }
      setDrafting(true);
      setComposeError(null);
      try {
        const res = await fetch("/api/email/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "polish",
            existingDraft: compose.body,
            subject: compose.subject,
            to: compose.to,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setComposeError(data.error || "Draft failed");
          return;
        }
        setCompose((c) => (c ? { ...c, body: data.draft } : c));
      } finally {
        setDrafting(false);
      }
      return;
    }

    if (!compose.threadId && !selected) return;
    setDrafting(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: compose.threadId || selected?.threadId,
          mode: compose.mode === "followup" ? "followup" : "reply",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error || "Draft failed");
        return;
      }
      setCompose((c) =>
        c
          ? {
              ...c,
              body: data.draft,
              to: data.to || c.to,
              subject: data.subject || c.subject,
            }
          : c
      );
    } finally {
      setDrafting(false);
    }
  };

  const rewrite = async (
    tone: "shorter" | "formal" | "casual" | "regenerate"
  ) => {
    if (!compose?.body.trim()) return;
    setDrafting(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: compose.threadId || selected?.threadId,
          mode: "rewrite",
          rewriteTone: tone,
          existingDraft: compose.body,
          subject: compose.subject,
          to: compose.to,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error || "Rewrite failed");
        return;
      }
      setCompose((c) => (c ? { ...c, body: data.draft } : c));
    } finally {
      setDrafting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" ) {
        e.preventDefault();
        document.getElementById("email-search")?.focus();
      }
      if (e.key === "r" && selected) {
        e.preventDefault();
        void openReply(selected);
      }
      if (e.key === "c") {
        e.preventDefault();
        openComposeNew();
      }
      if (e.key === "e" && selected && googleConnected) {
        e.preventDefault();
        void runThreadAction(selected, "archive");
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const idx = listEmails.findIndex(
          (x) => x.id === selectedId || x.threadId === selectedId
        );
        const next =
          e.key === "j"
            ? listEmails[Math.min(idx + 1, listEmails.length - 1)]
            : listEmails[Math.max(idx - 1, 0)];
        if (next) setSelectedId(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!state) return null;

  const userInitial =
    (getDisplayFirstName(state.user?.name) || "U").charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "email-alexa flex flex-col flex-1 min-h-0 h-0",
        MOBILE_HEIGHT
      )}
    >
      <div className="email-mobile-shell glass-panel-strong rounded-none sm:rounded-2xl flex flex-col flex-1 min-h-0 h-0 overflow-hidden ring-1 ring-white/10 relative max-lg:ring-0">
        {/* Desktop top bar */}
        <div
          className={cn(
            "hidden lg:flex px-5 py-2.5 border-b border-white/10 shrink-0 items-center gap-2"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/70 truncate">
              {navTitle(nav)}
              <span className="text-white/35 font-normal">
                {" "}
                · {listEmails.length} messages
              </span>
            </p>
          </div>
          {!googleConnected && (
            <Link href="/settings">
              <Button size="sm" variant="outline">
                <Link2 size={14} />
                <span className="ml-1">Connect Gmail</span>
              </Button>
            </Link>
          )}
          <RealtimeVoiceButton variant="inline" />
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              id="email-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full rounded-full bg-white/[0.04] ring-1 ring-white/10 pl-9 pr-3 py-1.5 text-sm text-ink placeholder:text-white/30 focus:outline-none focus:ring-sky-400/35"
            />
          </div>
        </div>

        {/* Mobile Gmail-style search bar */}
        {!mobileReading && (
          <div className="lg:hidden shrink-0 px-3 pt-2 pb-1 safe-area-top">
            <div className="em-search-pill flex items-center gap-2 rounded-full h-12 px-2.5 shadow-md shadow-black/20">
              <button
                type="button"
                className="p-2 rounded-full text-white/80 hover:bg-white/10"
                aria-label="Open folders"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu size={22} strokeWidth={1.75} />
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in emails"
                className="em-search-pill flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] placeholder:text-[var(--em-muted)]"
              />
              <RealtimeVoiceButton variant="inline" />
              <Link
                href="/settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3d6a9a] text-[13px] font-semibold text-white"
                aria-label="Profile"
              >
                {userInitial}
              </Link>
            </div>
          </div>
        )}

        {/* Mobile folder drawer — Gmail style */}
        {mobileNavOpen && (
          <div className="lg:hidden absolute inset-0 z-40 flex">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close folders"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="em-drawer relative z-10 flex h-full w-[min(20rem,86vw)] flex-col shadow-2xl safe-area-top">
              <EmailSidebar
                variant="drawer"
                active={nav}
                counts={counts}
                onSelect={(id) => {
                  setNav(id);
                  setMobileNavOpen(false);
                }}
                onCompose={() => {
                  setMobileNavOpen(false);
                  openComposeNew();
                }}
                className="flex-1 border-r-0 w-full"
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 min-h-0 h-0">
          <EmailSidebar
            active={nav}
            counts={counts}
            onSelect={setNav}
            onCompose={openComposeNew}
            title="Mail"
            subtitle={`${googleConnected ? "Gmail" : "Demo inbox"}${
              counts.to_respond ? ` · ${counts.to_respond} to respond` : ""
            }`}
            className="hidden lg:flex w-52 xl:w-56 shrink-0"
          />

          {/* List column */}
          <div
            className={cn(
              "w-full lg:w-[22rem] xl:w-[24rem] shrink-0 flex flex-col min-h-0 h-full border-r border-white/[0.06] bg-[#0c1018] max-lg:bg-[var(--em-bg)] max-lg:border-r-0",
              mobileReading && "hidden lg:flex"
            )}
          >
            <div className="hidden lg:block shrink-0 px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold text-white/90 tracking-tight">
                  {navTitle(nav)}
                </h2>
                <span className="text-[11px] text-white/30 tabular-nums">
                  {listEmails.length}
                </span>
              </div>
              {showFilterTabs ? (
                <div className="mt-2.5 flex gap-1">
                  {(
                    [
                      { id: "inbox" as EmailNavId, label: "All" },
                      { id: "to_respond" as EmailNavId, label: "Active" },
                      { id: "starred" as EmailNavId, label: "Starred" },
                      { id: "fyi" as EmailNavId, label: "FYI" },
                    ] as const
                  ).map(({ id, label }) => {
                    const active = nav === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setNav(id)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "bg-[#5b4a8a] text-white"
                            : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <EmailThreadList
              emails={listEmails}
              selectedId={selectedId}
              showTriage={showTriage}
              loading={loadingList && isFolder(nav) && nav !== "inbox"}
              onSelect={(e) => {
                if (nav === "drafts" || e.draftId) {
                  openDraft(e);
                  return;
                }
                setSelectedId(e.id);
              }}
              onToggleStar={(e) =>
                void runThreadAction(e, e.isStarred ? "unstar" : "star")
              }
            />
            {nextPageToken && isFolder(nav) && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadFolder(nav, nextPageToken, true)}
                className="m-2 py-2 rounded-lg text-xs font-medium text-white/50 bg-white/[0.04] ring-1 ring-white/[0.06] disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-white/[0.06]"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Load more"
                )}
              </button>
            )}
          </div>

          {/* Reading + compose */}
          <section
            className={cn(
              "flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden",
              !mobileReading && "hidden lg:flex"
            )}
          >
            {selected ? (
              <>
                <div
                  className={cn(
                    "flex-1 min-h-0 h-0 flex flex-col overflow-hidden",
                    compose && "hidden lg:flex"
                  )}
                >
                  <EmailReadingPane
                    email={selected}
                    onClose={() => {
                      setSelectedId(null);
                      if (compose) void saveDraftOnClose(compose);
                    }}
                    onReply={() => void openReply(selected)}
                    onForward={() => openForward(selected)}
                    onAction={(a) => void runThreadAction(selected, a)}
                    busy={actionBusy}
                    showTriage={showTriage}
                  />
                </div>
                {/* Desktop: docked compose under reading pane */}
                <div className="hidden lg:block">
                  <ComposePanel
                    open={!!compose}
                    variant="dock"
                    value={
                      compose ?? {
                        mode: "reply",
                        to: "",
                        cc: "",
                        bcc: "",
                        subject: "",
                        body: "",
                      }
                    }
                    onChange={(v) => setCompose(v)}
                    onClose={closeCompose}
                    onSend={() => void sendCompose()}
                    onAiDraft={() => void aiDraft()}
                    onRewrite={(t) => void rewrite(t)}
                    drafting={drafting}
                    sending={sending}
                    error={composeError}
                    recipientSuggestions={recipientSuggestions}
                  />
                </div>
              </>
            ) : compose ? (
              <div className="hidden lg:flex flex-1 min-h-0 flex-col">
                <ComposePanel
                  open
                  variant="dock"
                  value={compose}
                  onChange={(v) => setCompose(v)}
                  onClose={closeCompose}
                  onSend={() => void sendCompose()}
                  onAiDraft={() => void aiDraft()}
                  onRewrite={(t) => void rewrite(t)}
                  drafting={drafting}
                  sending={sending}
                  error={composeError}
                  recipientSuggestions={recipientSuggestions}
                />
              </div>
            ) : (
              <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center px-10">
                <p className="text-[15px] font-medium text-white/55">
                  Select a conversation
                </p>
                <p className="text-[13px] text-white/30 mt-1.5 max-w-xs leading-relaxed">
                  Choose a thread from the list to read and reply.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Mobile Compose FAB — Gmail-style, Alexa cyan */}
        {!mobileReading && !compose && (
          <button
            type="button"
            onClick={openComposeNew}
            className="em-fab lg:hidden absolute right-4 bottom-5 z-20 flex h-14 items-center gap-2 rounded-2xl px-5 text-[15px] font-semibold safe-area-bottom active:scale-[0.97] transition"
            aria-label="Compose"
          >
            <PenSquare size={20} strokeWidth={2} />
            Compose
          </button>
        )}

        {/* Mobile: full-screen compose (reply / forward / new) — Gmail style */}
        {!!compose && (
          <div className="lg:hidden absolute inset-0 z-30 flex flex-col bg-[var(--em-bg,#0a1628)]">
            <ComposePanel
              open
              variant="fullscreen"
              value={compose}
              onChange={(v) => setCompose(v)}
              onClose={closeCompose}
              onSend={() => void sendCompose()}
              onAiDraft={() => void aiDraft()}
              onRewrite={(t) => void rewrite(t)}
              drafting={drafting}
              sending={sending}
              error={composeError}
              recipientSuggestions={recipientSuggestions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
