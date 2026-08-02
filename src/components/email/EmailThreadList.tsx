"use client";

import type { Email } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { toEmailPreview } from "@/lib/email-html";
import { bucketLabel, initials } from "@/lib/email-buckets";
import type { InboxBucket } from "@/lib/email-buckets";
import { Star, MessagesSquare } from "lucide-react";

const AVATAR_TONES = [
  "bg-[#3d5a80] text-sky-100",
  "bg-[#3d4f7a] text-cyan-100",
  "bg-[#2f5a6a] text-teal-100",
  "bg-[#4a5a8a] text-indigo-100",
  "bg-[#2f4f5c] text-sky-100",
  "bg-[#355a70] text-cyan-50",
];

function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}

function peerFromAddress(to: string): string {
  const first = to.split(",")[0]?.trim() || to;
  const named = first.match(/^(.+?)\s*<[^>]+>$/);
  if (named?.[1]) return named[1].replace(/"/g, "").trim();
  return first.replace(/[<>]/g, "").trim() || to;
}

function bucketPillClass(bucket: InboxBucket, mobile?: boolean): string {
  if (mobile) {
    switch (bucket) {
      case "to_respond":
        return "em-tag";
      case "meeting":
        return "bg-[#5eb3f0]/25 text-[#9fd4f5]";
      case "purchases":
        return "em-tag";
      case "marketing":
        return "bg-white/10 text-white/55";
      case "travel":
        return "bg-cyan-500/20 text-cyan-100";
      default:
        return "bg-white/10 text-white/50";
    }
  }
  switch (bucket) {
    case "to_respond":
      return "bg-orange-500/15 text-orange-200/90";
    case "fyi":
      return "bg-white/[0.06] text-white/50";
    case "meeting":
      return "bg-violet-500/15 text-violet-200/90";
    case "marketing":
      return "bg-white/[0.04] text-white/40";
    case "purchases":
      return "bg-amber-500/12 text-amber-200/85";
    case "travel":
      return "bg-cyan-500/12 text-cyan-200/85";
    default:
      return "bg-white/[0.06] text-white/50";
  }
}

export function EmailThreadList({
  emails,
  selectedId,
  onSelect,
  onToggleStar,
  loading,
  showTriage = true,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  onToggleStar: (email: Email) => void;
  loading?: boolean;
  showTriage?: boolean;
}) {
  if (loading) {
    return (
      <div className="p-8 text-sm text-white/35 animate-pulse">Loading mail…</div>
    );
  }

  if (!emails.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-white/35">No messages here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto min-h-0 flex-1 h-0 touch-pan-y">
      {emails.map((email) => {
        const active =
          selectedId === email.id || selectedId === email.threadId;
        const count = email.messageCount ?? email.threadMessages?.length ?? 1;
        const bucket = showTriage ? email.inboxBucket : undefined;
        const preview = email.preview ? toEmailPreview(email.preview) : "";
        const peerLabel =
          !showTriage && email.to?.trim()
            ? peerFromAddress(email.to)
            : email.from;

        return (
          <div
            key={email.threadId || email.id}
            className={cn(
              "group relative flex transition-colors",
              // Separators between emails (mobile + desktop)
              "border-b border-[var(--em-line,rgba(148,163,184,0.22))]",
              active
                ? "lg:bg-[#1a2235]"
                : !email.isRead
                  ? "lg:bg-white/[0.025]"
                  : "lg:hover:bg-white/[0.03]",
              // Mobile Gmail-like rows
              "max-lg:px-3 max-lg:py-3 max-lg:gap-3",
              !email.isRead && "max-lg:em-row-unread"
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#5eb3f0] hidden lg:block"
              />
            ) : null}

            {/* Desktop star (left) */}
            <button
              type="button"
              className="hidden lg:block px-2.5 self-start pt-3.5 text-white/20 hover:text-amber-200"
              aria-label={email.isStarred ? "Unstar" : "Star"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email);
              }}
            >
              <Star
                size={14}
                className={
                  email.isStarred ? "fill-amber-300 text-amber-300" : undefined
                }
              />
            </button>

            <button
              type="button"
              className="flex-1 min-w-0 text-left lg:py-3 lg:pr-3"
              onClick={() => onSelect(email)}
            >
              <div className="flex items-start gap-3 lg:gap-2.5">
                <div
                  className={cn(
                    "mt-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold",
                    "h-10 w-10 text-[13px] lg:h-9 lg:w-9 lg:text-[11px]",
                    avatarTone(peerLabel)
                  )}
                >
                  {initials(peerLabel)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span
                      className={cn(
                        "truncate max-lg:text-[15px] lg:text-[13px]",
                        !email.isRead
                          ? "font-semibold text-white"
                          : "font-medium text-white/75 max-lg:text-white/90"
                      )}
                    >
                      {peerLabel}
                    </span>
                    {bucket ? (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-px text-[10px] font-medium max-lg:hidden",
                          bucketPillClass(bucket)
                        )}
                      >
                        {bucketLabel(bucket)}
                      </span>
                    ) : null}
                    {count > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-white/35 shrink-0 max-lg:hidden">
                        <MessagesSquare size={10} />
                        {count}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 tabular-nums flex items-center gap-1.5 max-lg:text-[12px] lg:text-[11px] text-white/40">
                      {formatRelativeTime(email.receivedAt)}
                      {!email.isRead ? (
                        <span
                          className="max-lg:inline-block hidden h-2 w-2 rounded-full bg-[var(--em-unread,#5eb3f0)]"
                          aria-label="Unread"
                        />
                      ) : null}
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-0.5 line-clamp-1 leading-snug max-lg:text-[14px] lg:text-[13px]",
                      !email.isRead ? "text-white/90 font-medium" : "text-white/60"
                    )}
                  >
                    {email.subject || "(no subject)"}
                  </p>

                  <div className="mt-0.5 flex items-center gap-2 min-w-0">
                    {preview ? (
                      <p className="min-w-0 flex-1 text-[13px] lg:text-[12px] text-[var(--em-muted,#8b9cb3)] line-clamp-1 leading-relaxed">
                        {preview}
                      </p>
                    ) : (
                      <span className="flex-1" />
                    )}
                    {bucket ? (
                      <span
                        className={cn(
                          "lg:hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          bucketPillClass(bucket, true)
                        )}
                      >
                        {bucketLabel(bucket)}
                      </span>
                    ) : null}
                    {/* Mobile star on the right like Gmail */}
                    <button
                      type="button"
                      className="lg:hidden shrink-0 p-1 text-white/35"
                      aria-label={email.isStarred ? "Unstar" : "Star"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(email);
                      }}
                    >
                      <Star
                        size={18}
                        className={
                          email.isStarred
                            ? "fill-amber-300 text-amber-300"
                            : undefined
                        }
                      />
                    </button>
                  </div>
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
