"use client";

import { MessageCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LushEmpty } from "@/components/layout/PageShell";
import { formatIgDate, formatCount, type IgComment } from "./types";

export function InstagramCommentsPanel({
  comments,
  loading,
  error,
  onDraftReply,
}: {
  comments: IgComment[];
  loading: boolean;
  error: string | null;
  onDraftReply: (comment: IgComment) => void;
}) {
  if (loading) {
    return <p className="text-sm text-ink-muted py-4">Loading comments…</p>;
  }
  if (error) {
    return <LushEmpty message={error} icon={MessageCircle} />;
  }
  if (comments.length === 0) {
    return <LushEmpty message="Comments are not available for this post." icon={MessageCircle} />;
  }

  return (
    <ul className="space-y-2.5">
      {comments.map((c) => (
        <li
          key={c.id}
          className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">@{c.username ?? "user"}</span>
            <span className="text-[11px] text-ink-muted">{formatIgDate(c.timestamp)}</span>
          </div>
          <p className="text-sm text-ink-secondary mt-1 leading-relaxed break-words">{c.text}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Heart size={11} className="text-rose-300" /> {formatCount(c.likeCount)}
            </span>
            <Button size="sm" variant="outline" onClick={() => onDraftReply(c)}>
              Draft reply
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
