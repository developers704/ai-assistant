export interface IgStatus {
  connected: boolean;
  pageId: string | null;
  instagramBusinessId: string | null;
  graphVersion: string;
  hasToken: boolean;
  disconnected?: boolean;
  purged?: boolean;
  canReconnect?: boolean;
}

export interface IgAccount {
  id: string;
  username: string;
  name?: string;
  followersCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string | null;
}

export interface IgPost {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export interface IgComment {
  id: string;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  likeCount: number | null;
  replyCount: number | null;
}

export interface IgInsight {
  name: string;
  title: string | null;
  value: number | null;
}

export interface IgParticipant {
  id: string;
  username: string | null;
  name?: string | null;
}

export interface IgConversation {
  id: string;
  participants: IgParticipant[];
  snippet: string | null;
  updatedTime: string | null;
  messageCount: number | null;
  unreadCount: number | null;
}

export interface IgMessage {
  id: string;
  from: IgParticipant | null;
  message: string | null;
  createdTime: string | null;
}

export function formatIgTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatIgDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
