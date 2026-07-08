"use client";

import { LushEmpty } from "@/components/layout/PageShell";
import { ImageIcon } from "lucide-react";
import { InstagramPostCard } from "./InstagramPostCard";
import type { IgPost } from "./types";

export function InstagramPostsList({
  posts,
  selectedId,
  onSelect,
  emptyMessage = "No Instagram posts found.",
}: {
  posts: IgPost[];
  selectedId: string | null;
  onSelect: (post: IgPost) => void;
  emptyMessage?: string;
}) {
  if (posts.length === 0) {
    return <LushEmpty message={emptyMessage} icon={ImageIcon} />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {posts.map((post) => (
        <InstagramPostCard
          key={post.id}
          post={post}
          active={selectedId === post.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
