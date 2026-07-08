"use client";

import { LushMetric } from "@/components/layout/PageShell";
import { formatCount, formatIgDate, type IgAccount, type IgPost } from "./types";

export function InstagramOverviewCards({
  account,
  posts,
}: {
  account: IgAccount | null;
  posts: IgPost[];
}) {
  const latest = posts[0];

  const withEngagement = posts.filter(
    (p) => p.likeCount != null || p.commentsCount != null
  );
  const avgEngagement =
    withEngagement.length > 0
      ? Math.round(
          withEngagement.reduce(
            (sum, p) => sum + (p.likeCount ?? 0) + (p.commentsCount ?? 0),
            0
          ) / withEngagement.length
        )
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <LushMetric
        label="Followers"
        value={formatCount(account?.followersCount)}
        accent="violet"
      />
      <LushMetric label="Total Posts" value={formatCount(account?.mediaCount)} accent="sky" />
      <LushMetric
        label="Latest Post"
        value={latest ? formatIgDate(latest.timestamp) : "—"}
      />
      <LushMetric
        label="Avg Engagement"
        value={avgEngagement != null ? formatCount(avgEngagement) : "n/a"}
        accent="amber"
        footer={
          avgEngagement != null ? (
            <span className="text-xs text-white/40">likes + comments / post</span>
          ) : (
            <span className="text-xs text-white/40">not available</span>
          )
        }
      />
    </div>
  );
}
