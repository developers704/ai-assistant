"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  MoreHorizontal,
  Paperclip,
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
  messageListPreview,
  stripQuotedTail,
  type MailMessage,
} from "@/lib/valliani-mail/types";
import { VallianiAttachmentPanel } from "@/components/valliani-mail/AttachmentPanel";
import { InlineReplyBox } from "@/components/valliani-mail/InlineReplyBox";
import type { ComposeDraft } from "@/components/valliani-mail/ComposePanel";
import type { AiRewriteTone } from "@/lib/valliani-mail/ai-draft";

export type ReadingAction =
  | "star"
  | "unstar"
  | "archive"
  | "trash"
  | "spam"
  | "mark_read"
  | "mark_unread";

const AVATAR_PALETTES = [
  "bg-emerald-600/50 text-emerald-50",
  "bg-sky-600/50 text-sky-50",
  "bg-violet-600/50 text-violet-50",
  "bg-amber-600/45 text-amber-50",
  "bg-rose-600/45 text-rose-50",
  "bg-cyan-600/45 text-cyan-50",
  "bg-indigo-600/50 text-indigo-50",
] as const;

function threadKey(m: MailMessage, idx: number): string {
  return `${m.sourceFolder || "f"}-${m.uid}-${idx}`;
}

function avatarClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 997;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]!;
}

/** Gmail-style: Fri, Aug 7, 9:33 PM (4 days ago) */
function gmailThreadDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const abs = d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const rel = formatRelativeTime(iso)
    .replace(/^Just now$/i, "just now")
    .replace(/^(\d+)m ago$/, "$1 min ago")
    .replace(/^(\d+)h ago$/, "$1 hours ago")
    .replace(/^(\d+)d ago$/, (_, n) =>
      n === "1" ? "1 day ago" : `${n} days ago`
    );
  return `${abs} (${rel})`;
}

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
  onReplyAiDraft,
  onReplyRewrite,
  replyBusy,
  replyDrafting,
  replyError,
}: {
  message: MailMessage | null;
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
  onReplyAiDraft?: () => void;
  onReplyRewrite?: (tone: AiRewriteTone) => void;
  replyBusy?: boolean;
  replyDrafting?: boolean;
  replyError?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const showInlineReply =
    !!replyDraft &&
    (replyDraft.mode === "reply" || replyDraft.mode === "replyAll") &&
    !replyDraft.forceModal;

  const threadMessages =
    thread && thread.length > 0 ? thread : message ? [message] : [];
  const threadId = threadMessages
    .map((m) => `${m.sourceFolder}:${m.uid}`)
    .join("|");

  useEffect(() => {
    if (!threadMessages.length) return;
    const next: Record<string, boolean> = {};
    threadMessages.forEach((m, idx) => {
      next[threadKey(m, idx)] = idx === threadMessages.length - 1;
    });
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

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

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
        className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-5 py-3 sm:py-4"
      >
        {/* Subject + Inbox chip (Gmail) */}
        <div className="flex flex-wrap items-center gap-2 px-2 sm:px-3 mb-1">
          <h1 className="text-[22px] sm:text-[26px] font-normal text-white tracking-tight leading-tight">
            {cleanSubject(message.subject)}
          </h1>
          <span className="inline-flex items-center rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white/55 ring-1 ring-white/10">
            Inbox
            {threadMessages.length > 1 ? (
              <span className="ml-1.5 text-white/40">{threadMessages.length}</span>
            ) : null}
          </span>
        </div>

        <div className="mt-3 border-t border-white/[0.08]">
          {threadMessages.map((m, idx) => {
            const key = threadKey(m, idx);
            const isLast = idx === threadMessages.length - 1;
            const isOpen =
              threadMessages.length === 1 ? true : (expanded[key] ?? isLast);
            return (
              <ThreadMessageCard
                key={key}
                message={m}
                expanded={isOpen}
                onToggle={() => toggleExpanded(key)}
                showActions={!showInlineReply && isLast && isOpen}
                onReply={onReply}
                onReplyAll={onReplyAll}
                onForward={onForward}
              />
            );
          })}
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
          onAiDraft={onReplyAiDraft}
          onRewrite={onReplyRewrite}
          busy={replyBusy}
          drafting={replyDrafting}
          error={replyError}
        />
      ) : null}
    </div>
  );
}

function ThreadMessageCard({
  message,
  expanded,
  onToggle,
  showActions,
  onReply,
  onReplyAll,
  onForward,
}: {
  message: MailMessage;
  expanded: boolean;
  onToggle: () => void;
  showActions: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  const from = message.from[0];
  const name = from ? displayName(from) : "Unknown";
  const rawText = message.bodyText?.trim() || message.preview;
  const text = stripQuotedTail(rawText) || rawText;
  const quoted =
    rawText.length > text.length ? rawText.slice(text.length).trim() : "";
  const [showQuote, setShowQuote] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const html =
    !quoted && message.bodyHtml?.trim()
      ? sanitizeEmailHtmlForPreview(message.bodyHtml)
      : "";
  const folder = message.sourceFolder || "INBOX";
  const snippet = (
    stripQuotedTail(messageListPreview(message)) ||
    messageListPreview(message) ||
    text.replace(/\s+/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const hasAtt =
    message.hasAttachments || (message.attachments?.length ?? 0) > 0;
  const dateLabel = gmailThreadDate(message.date);
  const toLabel =
    message.to.map((a) => displayName(a)).join(", ") || "me";
  const av = avatarClass(name);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-2 sm:px-3 py-3.5 text-left border-b border-white/[0.08] hover:bg-white/[0.035] transition-colors"
        aria-expanded={false}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
            av
          )}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
        <span className="w-[7.5rem] sm:w-[9.5rem] shrink-0 truncate font-semibold text-[13px] sm:text-[14px] text-white">
          {name}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] sm:text-[14px] text-white/45">
          {snippet}
        </span>
        <span className="shrink-0 flex items-center gap-2 pl-2">
          {hasAtt ? (
            <Paperclip size={14} className="text-white/40 hidden sm:block" />
          ) : null}
          <span className="text-[11px] sm:text-[12px] text-white/45 tabular-nums whitespace-nowrap max-w-[9.5rem] sm:max-w-none truncate">
            {dateLabel}
          </span>
        </span>
      </button>
    );
  }

  return (
    <article className="border-b border-white/[0.08] px-2 sm:px-3 py-4 hover:bg-white/[0.015]">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
            av
          )}
          aria-label="Collapse message"
        >
          {name.slice(0, 1).toUpperCase()}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onToggle}
                className="flex flex-wrap items-baseline gap-x-2 text-left"
                aria-expanded
              >
                <span className="font-semibold text-[14px] sm:text-[15px] text-white">
                  {name}
                </span>
                {from?.address ? (
                  <span className="text-[12px] text-white/40 truncate">
                    &lt;{from.address}&gt;
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="mt-0.5 inline-flex items-center gap-0.5 text-[12px] text-white/45 hover:text-white/70"
                onClick={() => setDetailsOpen((v) => !v)}
              >
                to {toLabel}
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform",
                    detailsOpen && "rotate-180"
                  )}
                />
              </button>
            </div>

            <div className="shrink-0 flex items-center gap-0.5">
              <span className="hidden sm:inline text-[12px] text-white/45 tabular-nums mr-1 max-w-[14rem] truncate">
                {dateLabel}
              </span>
              <IconBtn
                label="Reply"
                onClick={onReply}
                icon={<Reply size={16} />}
              />
              <IconBtn
                label="Collapse"
                onClick={onToggle}
                icon={<MoreHorizontal size={16} />}
              />
            </div>
          </div>

          {detailsOpen ? (
            <div className="mt-2 rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-[12px] text-white/55 space-y-1">
              <p>
                <span className="text-white/35">from: </span>
                {from?.label || name}
                {from?.address ? ` <${from.address}>` : ""}
              </p>
              <p>
                <span className="text-white/35">to: </span>
                {message.to.map((a) => a.label || displayName(a)).join(", ") ||
                  "(none)"}
              </p>
              {message.cc.length ? (
                <p>
                  <span className="text-white/35">cc: </span>
                  {message.cc.map((a) => a.label || displayName(a)).join(", ")}
                </p>
              ) : null}
              <p>
                <span className="text-white/35">date: </span>
                {dateLabel}
              </p>
              <p className="sm:hidden">{dateLabel}</p>
            </div>
          ) : null}

          <p className="sm:hidden mt-1 text-[11px] text-white/40 tabular-nums">
            {dateLabel}
          </p>

          {/* Message body */}
          <div className="mt-4 text-[14px] sm:text-[15px] text-white/88 leading-[1.65]">
            {html ? (
              <div
                className="mail-html prose prose-invert max-w-none prose-sm break-words prose-p:my-2"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans">{text}</pre>
            )}

            {quoted ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-7 min-w-9 rounded-full bg-white/[0.06] px-2.5 text-[13px] text-white/50 hover:bg-white/10 ring-1 ring-white/12"
                  onClick={() => setShowQuote((v) => !v)}
                  aria-label={
                    showQuote ? "Hide quoted text" : "Show quoted text"
                  }
                >
                  ⋯
                </button>
                {showQuote ? (
                  <div className="mt-3 border-t border-white/15 pt-3 text-[13px] text-white/50 whitespace-pre-wrap font-sans leading-relaxed">
                    {quoted}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <VallianiAttachmentPanel
            attachments={message.attachments}
            folder={folder}
            uid={message.uid}
          />

          {showActions ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionChip
                icon={<Reply size={15} />}
                label="Reply"
                onClick={onReply}
              />
              <ActionChip
                icon={<ReplyAll size={15} />}
                label="Reply all"
                onClick={onReplyAll}
              />
              <ActionChip
                icon={<Forward size={15} />}
                label="Forward"
                onClick={onForward}
              />
            </div>
          ) : null}
        </div>
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
      className="p-2 rounded-full text-white/55 hover:bg-white/10 hover:text-white/85 disabled:opacity-40"
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
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium",
        "bg-transparent ring-1 ring-white/20 text-white/85 hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
