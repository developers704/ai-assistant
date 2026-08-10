"use client";

import { Loader2, Paperclip, Search, Star } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  cleanSubject,
  displayName,
  messageListPreview,
  type MailThreadListItem,
} from "@/lib/valliani-mail/types";

function emptyFolderCopy(folderTitle: string): string {
  const t = folderTitle.toLowerCase();
  if (t.includes("schedule")) {
    return "No scheduled emails. Send later from compose when the mail server supports it.";
  }
  if (t.includes("snooze")) {
    return "No snoozed emails. Messages you snooze will show up here.";
  }
  if (t.includes("favorite") || t.includes("star")) {
    return "No favorites yet. Star a message to find it here.";
  }
  if (t.includes("draft")) return "No drafts.";
  if (t.includes("trash")) return "Trash is empty.";
  if (t.includes("spam")) return "No spam.";
  return "No messages in this folder.";
}

export function MessageList({
  messages,
  selectedUid,
  loading,
  loadingMore,
  hasMore,
  search,
  onSearchChange,
  onSelect,
  onLoadMore,
  folderTitle,
}: {
  messages: MailThreadListItem[];
  selectedUid: number | null;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (message: MailThreadListItem) => void;
  onLoadMore?: () => void;
  folderTitle: string;
}) {
  return (
    <div className="flex flex-col min-h-0 h-full border-r border-white/10 bg-[#0b0f16]">
      <div className="shrink-0 px-3 sm:px-3 pt-2 sm:pt-3 pb-2.5 border-b border-white/10">
        {/* Desktop only — mobile header already shows the folder name */}
        <h3 className="hidden lg:block text-sm font-semibold text-white px-1">
          {folderTitle}
        </h3>
        <div className="relative lg:mt-2">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail"
            className="w-full rounded-2xl bg-white/[0.07] ring-1 ring-white/12 focus:ring-sky-400/50 pl-10 pr-3 py-2.5 sm:py-2 text-[15px] sm:text-sm text-white placeholder:text-white/40 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
        {loading && !messages.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[15px] text-white/50">
            <Loader2 size={18} className="animate-spin" />
            Loading…
          </div>
        ) : !messages.length ? (
          <p className="text-center text-[15px] text-white/45 py-16 px-4">
            {emptyFolderCopy(folderTitle)}
          </p>
        ) : (
          <ul>
            {messages.map((message) => {
              const unread = message.threadHasUnread;
              const starred = message.threadHasStar;
              const active =
                selectedUid != null &&
                (message.uid === selectedUid ||
                  message.threadUids.includes(selectedUid));
              const from =
                message.from[0] != null
                  ? displayName(message.from[0])
                  : "Unknown";
              return (
                <li key={`${message.sourceFolder || "f"}-${message.uid}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(message)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 sm:px-3 sm:py-2.5 border-b border-white/[0.06] transition-colors",
                      active ? "bg-sky-500/15" : "active:bg-white/[0.06] hover:bg-white/[0.04]",
                      unread && "bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex-1 min-w-0 truncate text-[16px] sm:text-[13px] leading-snug tracking-[-0.01em]",
                          unread
                            ? "font-semibold text-white"
                            : "font-medium text-white/85"
                        )}
                      >
                        {from}
                      </span>
                      {message.threadCount > 1 ? (
                        <span
                          className="text-[12px] sm:text-[10px] tabular-nums text-white/50 shrink-0 font-medium"
                          title={`${message.threadCount} messages in conversation`}
                        >
                          {message.threadCount}
                        </span>
                      ) : null}
                      {starred ? (
                        <Star
                          size={14}
                          className="text-amber-300 fill-amber-300 shrink-0"
                        />
                      ) : null}
                      {message.hasAttachments ? (
                        <Paperclip
                          size={14}
                          className="text-white/45 shrink-0"
                        />
                      ) : null}
                      <span className="text-[12px] sm:text-[11px] text-white/45 tabular-nums shrink-0">
                        {message.date
                          ? formatRelativeTime(message.date)
                          : ""}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 sm:mt-0.5 text-[14.5px] sm:text-[12.5px] truncate leading-snug",
                        unread ? "text-white/90 font-medium" : "text-white/65"
                      )}
                    >
                      {cleanSubject(message.subject)}
                    </p>
                    <p className="mt-0.5 text-[13.5px] sm:text-[11.5px] text-white/45 sm:text-white/35 truncate leading-snug">
                      {messageListPreview(message)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && onLoadMore ? (
          <div className="p-3 pb-6">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-xl py-2.5 text-[14px] sm:text-xs font-medium text-sky-300 hover:bg-white/5 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
