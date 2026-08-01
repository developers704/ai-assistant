"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime, cn } from "@/lib/utils";
import { sortEmails } from "@/lib/email-utils";
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
  type InboxBucket,
  type MailFolder,
} from "@/lib/email-buckets";
import { Link2, Loader2, Search } from "lucide-react";

const MOBILE_HEIGHT =
  "max-lg:h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-4rem)]";

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
    id === "marketing" ||
    id === "purchases" ||
    id === "travel"
  );
}

function composeHasContent(c: ComposeState): boolean {
  return !!(c.to.trim() || c.subject.trim() || c.body.trim());
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
  const { state } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nav, setNav] = useState<EmailNavId>("inbox");
  const [query, setQuery] = useState("");
  const [folderEmails, setFolderEmails] = useState<Email[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [markedRead, setMarkedRead] = useState<Set<string>>(new Set());

  const googleConnected = state?.integrations?.google?.connected ?? false;

  const inboxEmails = useMemo(() => {
    if (!state) return [];
    return sortEmails(dedupeEmails(state.emails.map(withInboxBucket)));
  }, [state]);

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
    } else {
      setFolderEmails([]);
      setNextPageToken(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on nav change
  }, [nav, loadFolder]);

  useEffect(() => {
    void syncUiSelection({ selectedEmailId: selectedId ?? undefined });
  }, [selectedId]);

  const listEmails = useMemo(() => {
    let list: Email[];
    if (isBucket(nav)) {
      list = inboxEmails.filter((e) => e.inboxBucket === nav);
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
      list.map((e) => (nav === "drafts" ? e : withInboxBucket(e)))
    );
  }, [nav, inboxEmails, folderEmails, query, googleConnected]);

  const counts = useMemo(() => {
    return {
      inbox: inboxEmails.length,
      starred:
        nav === "starred"
          ? folderEmails.length
          : inboxEmails.filter((e) => e.isStarred).length,
      sent: nav === "sent" ? folderEmails.length : undefined,
      drafts: nav === "drafts" ? folderEmails.length : undefined,
      to_respond: inboxEmails.filter((e) => e.inboxBucket === "to_respond")
        .length,
      fyi: inboxEmails.filter((e) => e.inboxBucket === "fyi").length,
      marketing: inboxEmails.filter((e) => e.inboxBucket === "marketing")
        .length,
      purchases: inboxEmails.filter((e) => e.inboxBucket === "purchases")
        .length,
      travel: inboxEmails.filter((e) => e.inboxBucket === "travel").length,
    };
  }, [inboxEmails, folderEmails, nav]);

  const selected =
    listEmails.find((e) => e.id === selectedId || e.threadId === selectedId) ??
    null;

  const mobileReading = !!selectedId;

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
    setFolderEmails((prev) =>
      prev.map((e) =>
        e.threadId === tid ? { ...e, isRead: true } : e
      )
    );
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
      subject,
      body: "",
      threadId: email.threadId,
      inReplyTo: latest.rfcMessageId,
      references: [latest.references, latest.rfcMessageId].filter(Boolean).join(" "),
    });
    // Auto-generate draft
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

  const openComposeNew = () => {
    setComposeError(null);
    setCompose({
      mode: "compose",
      to: "",
      subject: "",
      body: "",
    });
  };

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
          subject: c.subject || "(No subject)",
          body: c.body,
          threadId: c.threadId,
          draftId: c.draftId,
          inReplyTo: c.inReplyTo,
          references: c.references,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error || "Could not save draft");
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
        setFolderEmails((prev) => prev.filter((e) => e.threadId !== email.threadId));
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

  const sendCompose = async () => {
    if (!compose) return;
    setSending(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to: compose.to,
          subject: compose.subject,
          body: compose.body,
          threadId: compose.threadId,
          inReplyTo: compose.inReplyTo,
          references: compose.references,
          draftId: compose.draftId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error || "Send failed");
        return;
      }
      if (!googleConnected && compose.draftId) {
        writeLocalDrafts(
          readLocalDrafts().filter((d) => d.id !== compose.draftId)
        );
      }
      setCompose(null);
      if (nav === "drafts") void loadFolder("drafts");
    } catch {
      setComposeError("Send failed");
    } finally {
      setSending(false);
    }
  };

  const aiDraft = async () => {
    if (!compose?.threadId && !selected) return;
    setDrafting(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: compose?.threadId || selected?.threadId,
          mode: compose?.mode === "followup" ? "followup" : "reply",
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

  return (
    <div
      className={cn(
        "flex flex-col max-lg:-mx-3 max-lg:-mt-1 max-lg:-mb-3 lg:mx-0",
        MOBILE_HEIGHT
      )}
    >
      <div className="glass-panel-strong rounded-2xl lg:rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        {/* Top bar */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 shrink-0 flex items-center gap-2 safe-area-top">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-display font-bold text-gradient-title tracking-tight">
              Mail
            </h1>
            <p className="text-[11px] text-white/40 truncate">
              {googleConnected ? "Gmail" : "Demo inbox"}
              {counts.to_respond ? ` · ${counts.to_respond} to respond` : ""}
            </p>
          </div>
          {!googleConnected && (
            <Link href="/settings">
              <Button size="sm" variant="outline">
                <Link2 size={14} />
                <span className="ml-1 hidden sm:inline">Connect Gmail</span>
              </Button>
            </Link>
          )}
          <div className="relative w-full max-w-[220px] sm:max-w-xs hidden sm:block">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              id="email-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full rounded-full bg-white/[0.04] ring-1 ring-white/10 pl-9 pr-3 py-1.5 text-sm text-ink placeholder:text-white/30 focus:outline-none focus:ring-violet-400/35"
            />
          </div>
        </div>

        <div className="sm:hidden px-3 py-2 border-b border-white/10">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full rounded-full bg-white/[0.04] ring-1 ring-white/10 pl-9 pr-3 py-2 text-sm text-ink placeholder:text-white/30 focus:outline-none focus:ring-violet-400/35"
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <EmailSidebar
            active={nav}
            counts={counts}
            onSelect={setNav}
            onCompose={openComposeNew}
            className={cn(
              "w-[9.5rem] sm:w-44 shrink-0",
              mobileReading && "hidden lg:flex"
            )}
          />

          {/* List */}
          <div
            className={cn(
              "w-full lg:w-[22rem] xl:w-[26rem] shrink-0 flex flex-col min-h-0 border-r border-white/10",
              mobileReading && "hidden lg:flex"
            )}
          >
            <EmailThreadList
              emails={listEmails}
              selectedId={selectedId}
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
                className="m-2 py-2 rounded-xl text-xs font-medium text-violet-200 bg-violet-500/10 ring-1 ring-violet-400/25 disabled:opacity-50 flex items-center justify-center gap-2"
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
              "flex-1 min-w-0 flex flex-col min-h-0",
              !mobileReading && "hidden lg:flex"
            )}
          >
            {selected ? (
              <>
                <EmailReadingPane
                  email={selected}
                  onClose={() => setSelectedId(null)}
                  onReply={() => void openReply(selected)}
                  onAction={(a) => void runThreadAction(selected, a)}
                  busy={actionBusy}
                />
                <ComposePanel
                  open={!!compose}
                  value={
                    compose ?? {
                      mode: "reply",
                      to: "",
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
                />
                {!compose && (
                  <div className="shrink-0 px-3 py-2 border-t border-white/10 flex gap-2 safe-area-bottom lg:hidden">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => void openReply(selected)}
                    >
                      Reply
                    </Button>
                    {selected.inboxBucket === "to_respond" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openReply(selected, "followup")}
                      >
                        Follow up
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center px-6">
                <p className="text-ink font-medium">Select a conversation</p>
                <p className="text-sm text-ink-muted mt-1 max-w-sm">
                  Gmail-style inbox with AI drafts in your voice. Unfinished
                  messages are saved under Drafts when you close compose.
                </p>
                {selectedId === null && counts.to_respond ? (
                  <p className="text-xs text-sky-200/70 mt-3">
                    {counts.to_respond} need a response · last sync{" "}
                    {formatRelativeTime(new Date().toISOString())}
                  </p>
                ) : null}
              </div>
            )}

            {/* Compose-only overlay when no selection (new mail) */}
            {!selected && compose && (
              <ComposePanel
                open
                value={compose}
                onChange={(v) => setCompose(v)}
                onClose={closeCompose}
                onSend={() => void sendCompose()}
                onAiDraft={() => void aiDraft()}
                onRewrite={(t) => void rewrite(t)}
                drafting={drafting}
                sending={sending}
                error={composeError}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
