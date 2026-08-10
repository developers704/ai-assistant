"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Menu, PenSquare } from "lucide-react";
import { FolderSidebar } from "@/components/valliani-mail/FolderSidebar";
import { MessageList } from "@/components/valliani-mail/MessageList";
import {
  ReadingPane,
  type ReadingAction,
} from "@/components/valliani-mail/ReadingPane";
import {
  ComposePanel,
  splitRecipientList,
  type ComposeDraft,
} from "@/components/valliani-mail/ComposePanel";
import {
  archiveMessages,
  deleteMessages,
  getFolders,
  getMailboxSummary,
  getMessage,
  getMessagePage,
  getThread,
  logoutMail,
  sendMail,
  spamMessages,
  updateMessageFlags,
  withAllMailFolder,
} from "@/lib/valliani-mail/api";
import {
  ALL_MAIL_FOLDER,
  addressEmail,
  buildForwardBody,
  buildReplyBody,
  displayName,
  forwardSubject,
  isSeen,
  prettyFolderName,
  replySubject,
  dedupeThreadMessages,
  sortThreadOldestFirst,
  type MailAddress,
  type MailAuthUser,
  type MailFolder,
  type MailMessage,
  type MailSummary,
} from "@/lib/valliani-mail/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function emptyCompose(): ComposeDraft {
  return {
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
    attachments: [],
    mode: "new",
  };
}

function splitRecipients(raw: string): string[] {
  return splitRecipientList(raw);
}

function sourceFolderOf(message: MailMessage, fallback: string): string {
  const f = (message.sourceFolder || fallback).trim();
  return f && f !== ALL_MAIL_FOLDER ? f : fallback === ALL_MAIL_FOLDER ? "INBOX" : fallback;
}

export function MailShell({
  user,
  onLogout,
}: {
  user: MailAuthUser;
  onLogout: () => void;
}) {
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [summary, setSummary] = useState<MailSummary | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("INBOX");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [thread, setThread] = useState<MailMessage[]>([]);
  const [readingLoading, setReadingLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "read">("list");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const folderRef = useRef(selectedFolder);
  const searchRef = useRef(search);
  folderRef.current = selectedFolder;
  searchRef.current = search;

  const loadMeta = useCallback(async () => {
    const [folderList, summaryData] = await Promise.all([
      getFolders().then(withAllMailFolder),
      getMailboxSummary().catch(() => null),
    ]);
    setFolders(folderList);
    if (summaryData) setSummary(summaryData);
    setSelectedFolder((current) => {
      const hasCurrent = folderList.some(
        (f) => f.path.toLowerCase() === current.toLowerCase()
      );
      if (hasCurrent) return current;
      return (
        folderList.find((f) => f.path.toUpperCase() === "INBOX")?.path ??
        folderList[0]?.path ??
        "INBOX"
      );
    });
  }, []);

  const loadMessages = useCallback(
    async (opts?: { offset?: number; append?: boolean; search?: string }) => {
      const folder = folderRef.current;
      const offset = opts?.offset ?? 0;
      const append = opts?.append ?? false;
      if (append) setLoadingMore(true);
      else setListLoading(true);
      setError("");
      try {
        const page = await getMessagePage({
          folder,
          limit: PAGE_SIZE,
          offset,
          search: opts?.search ?? searchRef.current,
        });
        if (folderRef.current !== folder) return;
        setMessages((prev) =>
          append ? [...prev, ...page.messages] : page.messages
        );
        setHasMore(page.hasMore || page.messages.length >= PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setListLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadMeta();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mailbox");
      }
    })();
  }, [loadMeta]);

  useEffect(() => {
    setSelected(null);
    setMobileView("list");
    void loadMessages({ offset: 0, append: false });
  }, [selectedFolder, loadMessages]);

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void loadMessages({ offset: 0, append: false, search: value });
    }, 320);
  }

  async function openMessage(message: MailMessage) {
    setMobileView("read");
    setSelected(message);
    setThread([message]);
    setCompose((c) =>
      c &&
      (c.mode === "reply" || c.mode === "replyAll") &&
      c.replyToUid !== message.uid
        ? null
        : c
    );
    const folder = sourceFolderOf(message, selectedFolder);
    setReadingLoading(true);
    try {
      const full = await getMessage({ folder, uid: message.uid });
      const seed = { ...full, sourceFolder: full.sourceFolder || folder };
      setSelected(seed);
      setThread([seed]);
      if (!isSeen(message.flags)) {
        void updateMessageFlags({
          folder,
          uids: [message.uid],
          action: "add",
          flag: "\\Seen",
        }).catch(() => undefined);
        setMessages((prev) =>
          prev.map((m) =>
            m.uid === message.uid && !isSeen(m.flags)
              ? { ...m, flags: [...m.flags, "\\Seen"] }
              : m
          )
        );
      }
      // Load rest of conversation (Sent + Inbox siblings) in background
      void getThread({ folder, seed })
        .then((msgs) => {
          if (msgs.length) setThread(msgs);
        })
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open message");
    } finally {
      setReadingLoading(false);
    }
  }

  async function handleAction(action: ReadingAction) {
    if (!selected) return;
    const folder = sourceFolderOf(selected, selectedFolder);
    setActionBusy(true);
    setError("");
    try {
      if (action === "star" || action === "unstar") {
        await updateMessageFlags({
          folder,
          uids: [selected.uid],
          action: action === "star" ? "add" : "remove",
          flag: "\\Flagged",
        });
        setSelected((m) =>
          m
            ? {
                ...m,
                flags:
                  action === "star"
                    ? [...m.flags.filter((f) => f.toLowerCase() !== "\\flagged"), "\\Flagged"]
                    : m.flags.filter((f) => f.toLowerCase() !== "\\flagged"),
              }
            : m
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.uid === selected.uid
              ? {
                  ...m,
                  flags:
                    action === "star"
                      ? [
                          ...m.flags.filter(
                            (f) => f.toLowerCase() !== "\\flagged"
                          ),
                          "\\Flagged",
                        ]
                      : m.flags.filter((f) => f.toLowerCase() !== "\\flagged"),
                }
              : m
          )
        );
      } else if (action === "mark_read" || action === "mark_unread") {
        await updateMessageFlags({
          folder,
          uids: [selected.uid],
          action: action === "mark_read" ? "add" : "remove",
          flag: "\\Seen",
        });
        const nextFlags =
          action === "mark_read"
            ? [
                ...selected.flags.filter((f) => f.toLowerCase() !== "\\seen"),
                "\\Seen",
              ]
            : selected.flags.filter((f) => f.toLowerCase() !== "\\seen");
        setSelected({ ...selected, flags: nextFlags });
        setMessages((prev) =>
          prev.map((m) =>
            m.uid === selected.uid ? { ...m, flags: nextFlags } : m
          )
        );
      } else if (action === "archive") {
        await archiveMessages({ sourceFolder: folder, uids: [selected.uid] });
        removeFromList(selected.uid);
      } else if (action === "trash") {
        await deleteMessages({ folder, uids: [selected.uid] });
        removeFromList(selected.uid);
      } else if (action === "spam") {
        await spamMessages({ sourceFolder: folder, uids: [selected.uid] });
        removeFromList(selected.uid);
      }
      void getMailboxSummary()
        .then(setSummary)
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  function removeFromList(uid: number) {
    setMessages((prev) => prev.filter((m) => m.uid !== uid));
    setSelected(null);
    setThread([]);
    setMobileView("list");
  }

  function addressesFromRaw(raw: string): MailAddress[] {
    return splitRecipients(raw).map((addr) => ({
      name: "",
      address: addr,
      label: addr,
      avatarUrl: "",
    }));
  }

  function startReply(mode: "reply" | "replyAll") {
    if (!selected) return;
    // Reply against the latest message in the open thread
    const target = thread[thread.length - 1] ?? selected;
    const self = user.email.toLowerCase();
    const folder = sourceFolderOf(target, selectedFolder);
    let to: string[] = [];
    let cc: string[] = [];
    if (mode === "reply") {
      const prefer =
        target.replyTo.length > 0 ? target.replyTo : target.from;
      to = prefer.map(addressEmail).filter(Boolean);
    } else {
      const fromAddrs = (
        target.replyTo.length > 0 ? target.replyTo : target.from
      )
        .map(addressEmail)
        .filter(Boolean);
      to = fromAddrs;
      const others = [...target.to, ...target.cc]
        .map(addressEmail)
        .filter(
          (e) =>
            e &&
            e.toLowerCase() !== self &&
            !fromAddrs.some((f) => f.toLowerCase() === e.toLowerCase())
        );
      cc = others;
    }
    // IMAP replyToUid must be a real server uid — prefer original selection if optimistic
    const replyUid = target.uid > 0 ? target.uid : selected.uid;
    const replyFolder =
      target.uid > 0
        ? folder
        : sourceFolderOf(selected, selectedFolder);
    setCompose({
      to: to.join(", "),
      cc: cc.join(", "),
      bcc: "",
      subject: replySubject(target.subject || selected.subject),
      body: "",
      quote: buildReplyBody(target).trim(),
      attachments: [],
      mode,
      replyToUid: replyUid,
      replyToFolder: replyFolder,
      inReplyTo: target.messageId || selected.messageId || undefined,
      references: (() => {
        const ids = [
          ...target.references,
          ...selected.references,
          target.messageId,
          selected.messageId,
        ].filter(Boolean);
        return ids.length ? [...new Set(ids)] : undefined;
      })(),
      forceModal: false,
    });
    setComposeError("");
  }

  function startForward() {
    if (!selected) return;
    setCompose({
      to: "",
      cc: "",
      bcc: "",
      subject: forwardSubject(selected.subject),
      body: buildForwardBody(selected),
      attachments: [],
      mode: "forward",
      replyToUid: selected.uid,
      replyToFolder: sourceFolderOf(selected, selectedFolder),
    });
    setComposeError("");
  }

  async function handleSend() {
    if (!compose) return;
    setComposeBusy(true);
    setComposeError("");
    try {
      const userBody = compose.body.trim();
      const body = [userBody, compose.quote?.trim()]
        .filter(Boolean)
        .join("\n\n");
      const wasReply =
        compose.mode === "reply" || compose.mode === "replyAll";
      await sendMail({
        to: splitRecipients(compose.to),
        cc: splitRecipients(compose.cc),
        bcc: splitRecipients(compose.bcc),
        subject: compose.subject,
        body,
        composeMode: compose.mode,
        replyToUid: compose.replyToUid,
        replyToFolder: compose.replyToFolder,
        inReplyTo: compose.inReplyTo,
        references: compose.references,
        attachments: compose.attachments?.length
          ? compose.attachments
          : undefined,
      });

      // Show reply in this thread immediately (no need to open Sent)
      if (wasReply && selected) {
        const optimistic: MailMessage = {
          uid: -Date.now(),
          subject: compose.subject,
          from: [
            {
              name: user.name || user.email,
              address: user.email,
              label: user.name || user.email,
              avatarUrl: "",
            },
          ],
          to: addressesFromRaw(compose.to),
          cc: addressesFromRaw(compose.cc),
          bcc: addressesFromRaw(compose.bcc),
          date: new Date().toISOString(),
          flags: ["\\Seen"],
          preview: userBody.slice(0, 160),
          bodyText: userBody,
          bodyHtml: "",
          hasHtml: false,
          isHydrated: true,
          attachments: compose.attachments ?? [],
          hasAttachments: (compose.attachments?.length ?? 0) > 0,
          avatarUrl: "",
          sourceFolder: "Sent",
          messageId: `local-${Date.now()}`,
          inReplyTo: compose.inReplyTo ?? selected.messageId,
          references: compose.references?.length
            ? compose.references
            : selected.messageId
              ? [selected.messageId]
              : [],
          replyTo: [],
        };
        setThread((prev) =>
          dedupeThreadMessages(
            sortThreadOldestFirst(
              prev.some((m) => m.uid === optimistic.uid)
                ? prev
                : [...prev, optimistic]
            )
          )
        );
        const seed = selected;
        const folder = sourceFolderOf(seed, selectedFolder);
        window.setTimeout(() => {
          void getThread({ folder, seed })
            .then((msgs) => {
              if (msgs.length)
                setThread((prev) =>
                  dedupeThreadMessages([...prev.filter((m) => m.uid > 0), ...msgs])
                );
            })
            .catch(() => undefined);
        }, 1500);
      }

      setCompose(null);
      if (
        selectedFolder.toLowerCase().includes("sent") ||
        selectedFolder === ALL_MAIL_FOLDER
      ) {
        void loadMessages({ offset: 0 });
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setComposeBusy(false);
    }
  }

  async function handleLogout() {
    await logoutMail();
    onLogout();
  }

  const folderTitle = useMemo(() => {
    const hit = folders.find(
      (f) => f.path.toLowerCase() === selectedFolder.toLowerCase()
    );
    return hit?.name ?? prettyFolderName(selectedFolder);
  }, [folders, selectedFolder]);

  return (
    <div className="h-full min-h-0 flex flex-col rounded-none sm:rounded-3xl overflow-hidden glass-panel-strong ring-1 ring-white/10">
      {error ? (
        <div className="shrink-0 px-4 py-2 text-xs text-rose-200 bg-rose-500/15 border-b border-rose-400/20">
          {error}
        </div>
      ) : null}

      <div className="lg:hidden shrink-0 flex items-center gap-2 px-2 py-2 border-b border-white/10">
        <button
          type="button"
          className="p-2 rounded-full text-white/70 hover:bg-white/10"
          onClick={() => setDrawerOpen(true)}
          aria-label="Folders"
        >
          <Menu size={20} />
        </button>
        <span className="flex-1 text-sm font-semibold text-white truncate">
          {folderTitle}
        </span>
        <button
          type="button"
          className="p-2 rounded-full text-white/70 hover:bg-white/10"
          onClick={() => {
            setCompose(emptyCompose());
            setComposeError("");
          }}
          aria-label="Compose"
        >
          <PenSquare size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex relative">
        <FolderSidebar
          className="hidden lg:flex w-[240px] shrink-0"
          folders={folders}
          summary={summary}
          selectedFolder={selectedFolder}
          userEmail={user.email}
          onSelect={setSelectedFolder}
          onCompose={() => {
            setCompose(emptyCompose());
            setComposeError("");
          }}
          onLogout={() => void handleLogout()}
        />

        {drawerOpen ? (
          <div className="lg:hidden absolute inset-0 z-30 flex">
            <FolderSidebar
              className="w-[280px] shrink-0 h-full"
              folders={folders}
              summary={summary}
              selectedFolder={selectedFolder}
              userEmail={user.email}
              onSelect={(path) => {
                setSelectedFolder(path);
                setDrawerOpen(false);
              }}
              onCompose={() => {
                setDrawerOpen(false);
                setCompose(emptyCompose());
                setComposeError("");
              }}
              onLogout={() => void handleLogout()}
            />
            <button
              type="button"
              className="flex-1 bg-black/50"
              aria-label="Close folders"
              onClick={() => setDrawerOpen(false)}
            />
          </div>
        ) : null}

        <div
          className={cn(
            "w-full lg:w-[360px] xl:w-[400px] shrink-0 min-h-0",
            mobileView === "read" ? "hidden lg:flex lg:flex-col" : "flex flex-col"
          )}
        >
          <MessageList
            messages={messages}
            selectedUid={selected?.uid ?? null}
            loading={listLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            search={search}
            onSearchChange={onSearchChange}
            onSelect={(m) => void openMessage(m)}
            onLoadMore={() =>
              void loadMessages({ offset: messages.length, append: true })
            }
            folderTitle={folderTitle}
          />
        </div>

        <div
          className={cn(
            "flex-1 min-w-0 min-h-0",
            mobileView === "list" ? "hidden lg:flex lg:flex-col" : "flex flex-col"
          )}
        >
          <ReadingPane
            message={selected}
            thread={thread}
            loading={readingLoading}
            busy={actionBusy}
            onClose={() => {
              setMobileView("list");
              setSelected(null);
              setThread([]);
            }}
            onReply={() => startReply("reply")}
            onReplyAll={() => startReply("replyAll")}
            onForward={startForward}
            onAction={(a) => void handleAction(a)}
            replyDraft={
              compose &&
              (compose.mode === "reply" || compose.mode === "replyAll") &&
              !compose.forceModal
                ? compose
                : null
            }
            onReplyDraftChange={setCompose}
            onReplySend={() => void handleSend()}
            onReplyDiscard={() => setCompose(null)}
            onReplyExpand={() =>
              setCompose((c) => (c ? { ...c, forceModal: true } : c))
            }
            replyBusy={composeBusy}
            replyError={composeError}
          />
        </div>
      </div>

      {compose &&
      (compose.forceModal ||
        compose.mode === "new" ||
        compose.mode === "forward" ||
        !compose.mode) ? (
        <ComposePanel
          draft={compose}
          onChange={setCompose}
          onClose={() => setCompose(null)}
          onSend={() => void handleSend()}
          busy={composeBusy}
          error={composeError}
        />
      ) : null}

      {listLoading && folders.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <Loader2 className="animate-spin text-white/50" size={22} />
        </div>
      ) : null}
    </div>
  );
}
