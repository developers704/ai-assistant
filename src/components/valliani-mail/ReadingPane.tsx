"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronLeft,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  MoreHorizontal,
  Reply,
  ReplyAll,
  Star,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { sanitizeEmailHtmlForPreview } from "@/lib/email-html";
import {
  cleanSubject,
  displayName,
  isFlagged,
  isSeen,
  type MailMessage,
} from "@/lib/valliani-mail/types";
import { VallianiAttachmentPanel } from "@/components/valliani-mail/AttachmentPanel";
import { InlineReplyBox } from "@/components/valliani-mail/InlineReplyBox";
import type { ComposeDraft } from "@/components/valliani-mail/ComposePanel";

export type ReadingAction =
  | "star"
  | "unstar"
  | "archive"
  | "trash"
  | "spam"
  | "mark_read"
  | "mark_unread";

export function ReadingPane({
  message,
  thread,
  loading,
  busy,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onAction,
  replyDraft,
  onReplyDraftChange,
  onReplySend,
  onReplyDiscard,
  onReplyExpand,
  replyBusy,
  replyError,
}: {
  message: MailMessage | null;
  /** Oldest → newest conversation (includes `message`). */
  thread?: MailMessage[];
  loading?: boolean;
  busy?: boolean;
  onClose?: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onAction: (action: ReadingAction) => void;
  replyDraft?: ComposeDraft | null;
  onReplyDraftChange?: (next: ComposeDraft) => void;
  onReplySend?: () => void;
  onReplyDiscard?: () => void;
  onReplyExpand?: () => void;
  replyBusy?: boolean;
  replyError?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const showInlineReply =
    !!replyDraft &&
    (replyDraft.mode === "reply" || replyDraft.mode === "replyAll") &&
    !replyDraft.forceModal;

  const threadMessages =
    thread && thread.length > 0 ? thread : message ? [message] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [showInlineReply, replyDraft?.replyToUid, threadMessages.length]);

  if (!message && !loading) {
    return (
      <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-white/35 bg-[#0d121c]">
        Select a message to read
      </div>
    );
  }

  if (loading || !message) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/45 bg-[#0d121c]">
        <Loader2 size={16} className="animate-spin" />
        Opening…
      </div>
    );
  }

  const unread = !isSeen(message.flags);
  const starred = isFlagged(message.flags);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0d121c]">
      <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-1.5 border-b border-white/[0.06]">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2.5 rounded-full text-white/70 hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        ) : null}
        <div className="flex-1" />
        <IconBtn
          label="Archive"
          disabled={busy}
          onClick={() => onAction("archive")}
          icon={<Archive size={18} />}
        />
        <IconBtn
          label="Delete"
          disabled={busy}
          onClick={() => onAction("trash")}
          icon={<Trash2 size={18} />}
        />
        <IconBtn
          label={unread ? "Mark read" : "Mark unread"}
          disabled={busy}
          onClick={() => onAction(unread ? "mark_read" : "mark_unread")}
          icon={unread ? <MailOpen size={18} /> : <Mail size={18} />}
        />
        <IconBtn
          label={starred ? "Unstar" : "Star"}
          disabled={busy}
          onClick={() => onAction(starred ? "unstar" : "star")}
          icon={
            <Star
              size={18}
              className={starred ? "fill-amber-300 text-amber-300" : undefined}
            />
          }
        />
        <div className="relative">
          <IconBtn
            label="More"
            disabled={busy}
            onClick={() => setMoreOpen((v) => !v)}
            icon={<MoreHorizontal size={18} />}
          />
          {moreOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-[#161c28] ring-1 ring-white/10 shadow-xl py-1 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                  onClick={() => {
                    setMoreOpen(false);
                    onAction("spam");
                  }}
                >
                  <ShieldAlert size={15} />
                  Report spam
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            {cleanSubject(message.subject)}
          </h1>
          {threadMessages.length > 1 ? (
            <span className="shrink-0 rounded-full bg-white/8 ring-1 ring-white/10 px-2.5 py-1 text-[11px] font-medium text-white/55">
              {threadMessages.length} messages
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-5">
          {threadMessages.map((m, idx) => (
            <ThreadMessageCard
              key={`${m.sourceFolder}-${m.uid}-${idx}`}
              message={m}
              showActions={
                !showInlineReply && idx === threadMessages.length - 1
              }
              onReply={onReply}
              onReplyAll={onReplyAll}
              onForward={onForward}
            />
          ))}
        </div>
      </div>

      {showInlineReply &&
      replyDraft &&
      onReplyDraftChange &&
      onReplySend &&
      onReplyDiscard ? (
        <InlineReplyBox
          draft={replyDraft}
          onChange={onReplyDraftChange}
          onSend={onReplySend}
          onDiscard={onReplyDiscard}
          onExpand={onReplyExpand}
          busy={replyBusy}
          error={replyError}
        />
      ) : null}
    </div>
  );
}

function ThreadMessageCard({
  message,
  showActions,
  onReply,
  onReplyAll,
  onForward,
}: {
  message: MailMessage;
  showActions: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  const from = message.from[0];
  const html = message.bodyHtml?.trim()
    ? sanitizeEmailHtmlForPreview(message.bodyHtml)
    : "";
  const text = message.bodyText?.trim() || message.preview;
  const folder = message.sourceFolder || "INBOX";

  return (
    <article className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-sky-700/40 text-sky-100 flex items-center justify-center text-sm font-bold shrink-0">
          {(from ? displayName(from) : "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-white text-sm">
              {from ? displayName(from) : "Unknown"}
            </span>
            {from?.address ? (
              <span className="text-xs text-white/40">&lt;{from.address}&gt;</span>
            ) : null}
            <span className="text-xs text-white/35 ml-auto">
              {message.date ? formatRelativeTime(message.date) : ""}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-0.5 truncate">
            To: {message.to.map((a) => displayName(a)).join(", ") || "(none)"}
          </p>
        </div>
      </div>

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionChip icon={<Reply size={14} />} label="Reply" onClick={onReply} />
          <ActionChip
            icon={<ReplyAll size={14} />}
            label="Reply all"
            onClick={onReplyAll}
          />
          <ActionChip
            icon={<Forward size={14} />}
            label="Forward"
            onClick={onForward}
          />
        </div>
      ) : null}

      <VallianiAttachmentPanel
        attachments={message.attachments}
        folder={folder}
        uid={message.uid}
      />

      <div className="mt-3 text-[14px] text-white/85 leading-relaxed">
        {html ? (
          <div
            className="mail-html prose prose-invert max-w-none prose-sm break-words"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[14px]">{text}</pre>
        )}
      </div>
    </article>
  );
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="p-2.5 rounded-full text-white/70 hover:bg-white/10 disabled:opacity-40"
    >
      {icon}
    </button>
  );
}

function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
        "bg-white/5 ring-1 ring-white/10 text-white/80 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
