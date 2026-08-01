"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
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
  bucketLabel,
  type InboxBucket,
  type MailFolder,
} from "@/lib/email-buckets";
import { Link2, Loader2, Menu, PenSquare, Search, X } from "lucide-react";

const MOBILE_HEIGHT =
  "max-lg:h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-1.5rem)]";

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
    c.body.trim()
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
  const { state } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nav, setNav] = useState<EmailNavId>("inbox");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
      list.map((e) => {
        // Sent / drafts shouldn't show AI triage tags
        if (nav === "sent" || nav === "drafts") {
          return { ...e, inboxBucket: undefined, needsReply: false };
        }
        return withInboxBucket(e);
      })
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
  const showTriage = nav === "inbox" || isBucket(nav);
  const showFilterTabs = nav === "inbox" || isBucket(nav);

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
      cc: "",
      bcc: "",
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
      cc: "",
      bcc: "",
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
          cc: c.cc,
          bcc: c.bcc,
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
          cc: compose.cc,
          bcc: compose.bcc,
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
    <div className={cn("flex flex-col flex-1 min-h-0", MOBILE_HEIGHT)}>
      <div className="glass-panel-strong rounded-none sm:rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10 relative">
        {/* Top bar — compact on desktop (sidebar already shows Mail title) */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-white/10 shrink-0 flex items-center gap-2 safe-area-top">
          {!mobileReading && (
            <button
              type="button"
              className="lg:hidden p-2 -ml-1 rounded-xl text-white/70 hover:bg-white/10"
              aria-label="Open folders"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} />
            </button>
          )}
          <div className="min-w-0 flex-1 lg:hidden">
            <h1 className="text-lg font-display font-bold text-white tracking-tight">
              {mobileReading ? "Mail" : navTitle(nav)}
            </h1>
            <p className="text-[11px] text-white/40 truncate">
              {googleConnected ? "Gmail" : "Demo inbox"}
              {counts.to_respond ? ` · ${counts.to_respond} to respond` : ""}
            </p>
          </div>
          <div className="hidden lg:block min-w-0 flex-1">
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
                <span className="ml-1 hidden sm:inline">Connect Gmail</span>
              </Button>
            </Link>
          )}
          {!mobileReading && (
            <button
              type="button"
              onClick={openComposeNew}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl bg-[#5b4a8a] px-3 py-2 text-xs font-semibold text-white shadow-md"
            >
              <PenSquare size={14} />
              Compose
            </button>
          )}
          <div className="relative w-full max-w-[280px] sm:max-w-sm hidden sm:block">
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

        {!mobileReading && (
          <div className="sm:hidden px-3 py-2 border-b border-white/10 space-y-2">
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
            {/* Quick triage chips — full-width list, no side rail */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-none">
              {(
                [
                  "inbox",
                  "to_respond",
                  "fyi",
                  "starred",
                  "purchases",
                  "marketing",
                  "drafts",
                ] as EmailNavId[]
              ).map((id) => {
                const count = counts[id as keyof typeof counts];
                const active = nav === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNav(id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/40"
                        : "bg-white/[0.04] text-white/50 ring-1 ring-white/10"
                    )}
                  >
                    {navTitle(id)}
                    {count != null && count > 0 ? (
                      <span className="ml-1 tabular-nums opacity-70">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile folder drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden absolute inset-0 z-40 flex">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              aria-label="Close folders"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-10 flex h-full w-[min(18rem,85vw)] flex-col bg-[#0f1520] ring-1 ring-white/10 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                <p className="text-sm font-semibold text-ink">Folders</p>
                <button
                  type="button"
                  className="p-2 rounded-lg text-white/50 hover:bg-white/10"
                  aria-label="Close"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <EmailSidebar
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

        <div className="flex flex-1 min-h-0">
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
              "w-full lg:w-[22rem] xl:w-[24rem] shrink-0 flex flex-col min-h-0 border-r border-white/[0.06] bg-[#0c1018]",
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
                  showTriage={showTriage}
                />
                <ComposePanel
                  open={!!compose}
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
            ) : compose ? (
              <div className="hidden lg:flex flex-1 min-h-0 flex-col">
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

        {/* New-mail compose on phone (reading pane is hidden without selection) */}
        {!!compose && !selected && (
          <div className="lg:hidden absolute inset-0 z-30 flex flex-col bg-[#0c1018]">
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
          </div>
        )}
      </div>
    </div>
  );
}
