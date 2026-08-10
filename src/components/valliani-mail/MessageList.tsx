"use client";

import { Loader2, Paperclip, Search, Star } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  cleanSubject,
  displayName,
  messageListPreview,
  type MailThreadListItem,
} from "@/lib/valliani-mail/types";

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
    <div className="flex flex-col min-h-0 h-full border-r border-white/10 bg-[#0b0f16]/90">
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white px-1">{folderTitle}</h3>
        <div className="relative mt-2">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail"
            className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 focus:ring-sky-400/50 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/35 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !messages.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/45">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : !messages.length ? (
          <p className="text-center text-sm text-white/40 py-16 px-4">
            No messages in this folder.
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
                      "w-full text-left px-3 py-2.5 border-b border-white/[0.04] transition-colors",
                      active ? "bg-sky-500/15" : "hover:bg-white/[0.04]",
                      unread && "bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex-1 truncate text-[13px]",
                          unread
                            ? "font-semibold text-white"
                            : "font-medium text-white/75"
                        )}
                      >
                        {from}
                      </span>
                      {message.threadCount > 1 ? (
                        <span
                          className="text-[10px] tabular-nums text-white/40 shrink-0"
                          title={`${message.threadCount} messages in conversation`}
                        >
                          {message.threadCount}
                        </span>
                      ) : null}
                      {starred ? (
                        <Star
                          size={12}
                          className="text-amber-300 fill-amber-300 shrink-0"
                        />
                      ) : null}
                      {message.hasAttachments ? (
                        <Paperclip
                          size={12}
                          className="text-white/35 shrink-0"
                        />
                      ) : null}
                      <span className="text-[11px] text-white/35 tabular-nums shrink-0">
                        {message.date
                          ? formatRelativeTime(message.date)
                          : ""}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-[12.5px] truncate",
                        unread ? "text-white/85" : "text-white/50"
                      )}
                    >
                      {cleanSubject(message.subject)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-white/35 truncate">
                      {messageListPreview(message)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && onLoadMore ? (
          <div className="p-3">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-xl py-2 text-xs font-medium text-sky-300 hover:bg-white/5 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
