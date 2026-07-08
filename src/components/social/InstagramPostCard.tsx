"use client";

import Image from "next/image";
import { Heart, MessageCircle, Film, Images, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatIgDate, type IgPost } from "./types";

function TypeIcon({ type }: { type: string | null }) {
  if (type === "VIDEO" || type === "REELS") return <Film size={13} />;
  if (type === "CAROUSEL_ALBUM") return <Images size={13} />;
  return <ImageIcon size={13} />;
}

export function InstagramPostCard({
  post,
  active,
  onSelect,
}: {
  post: IgPost;
  active: boolean;
  onSelect: (post: IgPost) => void;
}) {
  const thumb = post.thumbnailUrl || post.mediaUrl;

  return (
    <button
      type="button"
      onClick={() => onSelect(post)}
      className={cn(
        "group text-left rounded-2xl overflow-hidden ring-1 transition-all",
        active
          ? "ring-fuchsia-400/45 shadow-[0_4px_24px_rgba(217,70,239,0.15)]"
          : "ring-white/[0.07] hover:ring-white/20"
      )}
    >
      <div className="relative aspect-square bg-black/30">
        {thumb ? (
          <Image
            src={thumb}
            alt={post.caption?.slice(0, 40) ?? "Instagram post"}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/25">
            <ImageIcon size={28} />
          </div>
        )}
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
          <TypeIcon type={post.mediaType} />
        </span>
      </div>
      <div className="p-2.5 bg-white/[0.02]">
        <p className="text-[11px] text-ink-muted">{formatIgDate(post.timestamp)}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-secondary">
          <span className="flex items-center gap-1">
            <Heart size={11} className="text-rose-300" /> {formatCount(post.likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={11} className="text-sky-300" /> {formatCount(post.commentsCount)}
          </span>
        </div>
      </div>
    </button>
  );
}
