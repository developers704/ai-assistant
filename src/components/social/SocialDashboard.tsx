"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  SectionHeading,
  LushPanel,
  LushEmpty,
  LushTabBar,
} from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Grid3x3,
  MessageCircle,
  BarChart2,
  Sparkles,
  Reply,
  ListChecks,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Inbox,
  Unlink,
  Link2,
  Loader2,
} from "lucide-react";
import { InstagramAccountHeader } from "./InstagramAccountHeader";
import { InstagramOverviewCards } from "./InstagramOverviewCards";
import { InstagramPostsList } from "./InstagramPostsList";
import { InstagramCommentsPanel } from "./InstagramCommentsPanel";
import { InstagramInbox } from "./InstagramInbox";
import { CompanyLinksSection } from "./CompanyLinksSection";
import {
  formatIgDate,
  type IgAccount,
  type IgComment,
  type IgInsight,
  type IgPost,
  type IgStatus,
} from "./types";

interface ApiError {
  error: string;
  code?: string;
}

async function getJson<T>(url: string): Promise<{ ok: boolean; data?: T; error?: ApiError }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body as ApiError };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: { error: "Network error reaching the server." } };
  }
}

export function SocialDashboard() {
  const { sendChat } = useApp();

  const [status, setStatus] = useState<IgStatus | null>(null);
  const [account, setAccount] = useState<IgAccount | null>(null);
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<IgPost | null>(null);
  const [comments, setComments] = useState<IgComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [insights, setInsights] = useState<IgInsight[]>([]);
  const [insightsNote, setInsightsNote] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const st = await getJson<IgStatus>("/api/social/instagram/status");
    if (st.ok && st.data) setStatus(st.data);

    if (!st.data?.connected) {
      setAccount(null);
      setPosts([]);
      setSelected(null);
      setLoading(false);
      setLoadError(
        st.data?.disconnected
          ? "Instagram is disconnected. Use Reconnect to restore the Meta link."
          : st.data?.hasToken
            ? "Instagram token expired or the business account is not set. Generate a new test token or use OAuth."
            : "Instagram is not connected. Add Meta env keys or connect via OAuth."
      );
      return;
    }

    const acc = await getJson<{ account: IgAccount }>("/api/social/instagram/account");
    if (acc.ok && acc.data) {
      setAccount(acc.data.account);
    } else if (acc.error) {
      setLoadError(acc.error.error);
    }

    const pd = await getJson<{ posts: IgPost[] }>("/api/social/instagram/posts");
    if (pd.ok && pd.data) {
      setPosts(pd.data.posts);
      if (pd.data.posts.length > 0) setSelected(pd.data.posts[0]);
    } else if (pd.error && !loadError) {
      setLoadError(pd.error.error);
    }

    setLoading(false);
  }, [loadError]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPostDetail = useCallback(async (post: IgPost) => {
    setSelected(post);
    setCommentsLoading(true);
    setCommentsError(null);
    setComments([]);
    setInsights([]);
    setInsightsNote(null);

    const [cm, ins] = await Promise.all([
      getJson<{ comments: IgComment[] }>(
        `/api/social/instagram/post-comments?mediaId=${encodeURIComponent(post.id)}`
      ),
      getJson<{ insights: IgInsight[]; note?: string }>(
        `/api/social/instagram/post-insights?mediaId=${encodeURIComponent(post.id)}`
      ),
    ]);

    if (cm.ok && cm.data) setComments(cm.data.comments);
    else setCommentsError(cm.error?.error ?? "Comments are not available for this post.");

    if (ins.ok && ins.data) {
      setInsights(ins.data.insights ?? []);
      setInsightsNote(ins.data.note ?? null);
    } else {
      setInsightsNote(ins.error?.error ?? "Insights are not available for this post.");
    }

    setCommentsLoading(false);
  }, []);

  const connected = status?.connected ?? false;
  const canReconnect = Boolean(status?.canReconnect && !connected);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/social/instagram/disconnect", { method: "POST" });
      setAccount(null);
      setPosts([]);
      setSelected(null);
      await loadAll();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/social/instagram/reconnect", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(body.error ?? "Could not reconnect Instagram.");
        return;
      }
      await loadAll();
    } finally {
      setDisconnecting(false);
    }
  };

  const [tab, setTab] = useState<"overview" | "inbox">("overview");

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <PageShell accent="rose" className="flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          <PageShellHeader className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <PageHeader
                gradient
                eyebrow="Instagram Business"
                title="Social Command Center"
                subtitle="Instagram Business performance and content management"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={connected ? "success" : "warning"}>
                  {connected ? "Connected" : "Not connected"}
                </Badge>
                {connected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDisconnect()}
                    disabled={disconnecting}
                    title="Disconnect Instagram"
                  >
                    {disconnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Unlink size={14} />
                    )}{" "}
                    Disconnect
                  </Button>
                ) : canReconnect ? (
                  <Button
                    size="sm"
                    onClick={() => void handleReconnect()}
                    disabled={disconnecting}
                    title="Reconnect Instagram"
                  >
                    {disconnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Link2 size={14} />
                    )}{" "}
                    Reconnect
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadAll()}
                  title="Refresh Instagram data"
                >
                  <RefreshCw size={14} /> Refresh
                </Button>
              </div>
            </div>
          </PageShellHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <PageShellBody>
              <CompanyLinksSection />

              <InstagramAccountHeader account={account} status={status} />

              {connected && (
                <LushTabBar
                  tabs={[
                    { id: "overview" as const, label: "Overview", icon: Grid3x3, color: "text-fuchsia-300" },
                    { id: "inbox" as const, label: "Inbox", icon: Inbox, color: "text-sky-300" },
                  ]}
                  active={tab}
                  onChange={setTab}
                />
              )}

              {tab === "inbox" && connected ? (
                <InstagramInbox
                  businessId={status?.instagramBusinessId ?? account?.id}
                  onRefresh={() => void loadAll()}
                />
              ) : loading ? (
                <p className="text-sm text-ink-muted py-6 text-center">Loading Instagram data…</p>
              ) : loadError ? (
                <LushPanel className="border border-amber-400/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-300 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-ink">{loadError}</p>
                      <p className="text-xs text-ink-muted mt-1">
                        Configure Meta env keys in <code>.env.local</code>, then Refresh.
                      </p>
                    </div>
                  </div>
                </LushPanel>
              ) : (
                <>
                  <InstagramOverviewCards account={account} posts={posts} />

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(300px,380px)] gap-5">
                    <div>
                      <SectionHeading
                        title="Recent Posts"
                        icon={Grid3x3}
                        iconClass="bg-fuchsia-500/12 text-fuchsia-300"
                      />
                      <InstagramPostsList
                        posts={posts}
                        selectedId={selected?.id ?? null}
                        onSelect={(p) => void loadPostDetail(p)}
                      />
                    </div>

                    <div className="lg:sticky lg:top-0 h-fit">
                      {selected ? (
                        <PostDetailPanel
                          post={selected}
                          comments={comments}
                          commentsLoading={commentsLoading}
                          commentsError={commentsError}
                          insights={insights}
                          insightsNote={insightsNote}
                          onDraftCaption={() =>
                            void sendChat(
                              `Draft an Instagram caption variation for this post: "${(selected.caption ?? "").slice(0, 200)}"`
                            )
                          }
                          onSummarizeComments={() =>
                            void sendChat(
                              `Summarize the audience sentiment from these Instagram comments: ${comments
                                .map((c) => c.text)
                                .filter(Boolean)
                                .slice(0, 10)
                                .join(" | ")}`
                            )
                          }
                          onDraftReply={(c) =>
                            void sendChat(
                              `Draft a friendly Instagram reply to this comment from @${c.username ?? "user"}: "${c.text ?? ""}"`
                            )
                          }
                        />
                      ) : (
                        <LushEmpty message="Select a post to see details." icon={Grid3x3} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </PageShellBody>
          </div>
        </div>
      </PageShell>
    </div>
  );
}

function PostDetailPanel({
  post,
  comments,
  commentsLoading,
  commentsError,
  insights,
  insightsNote,
  onDraftCaption,
  onSummarizeComments,
  onDraftReply,
}: {
  post: IgPost;
  comments: IgComment[];
  commentsLoading: boolean;
  commentsError: string | null;
  insights: IgInsight[];
  insightsNote: string | null;
  onDraftCaption: () => void;
  onSummarizeComments: () => void;
  onDraftReply: (comment: IgComment) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.02] p-4">
      <div>
        <p className="text-[11px] text-ink-muted">{formatIgDate(post.timestamp)} · {post.mediaType ?? "POST"}</p>
        <p className="text-sm text-ink-secondary mt-1 leading-relaxed line-clamp-4 break-words">
          {post.caption || <span className="italic text-ink-muted">No caption</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onDraftCaption}>
          <Sparkles size={14} /> Draft caption
        </Button>
        <Button size="sm" variant="outline" onClick={onSummarizeComments}>
          <ListChecks size={14} /> Summarize comments
        </Button>
        {post.permalink && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(post.permalink!, "_blank", "noopener")}
          >
            <ExternalLink size={14} /> Open on Instagram
          </Button>
        )}
      </div>

      <div>
        <SectionHeading
          title="Insights"
          icon={BarChart2}
          iconClass="bg-sky-500/12 text-sky-300"
        />
        {insights.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {insights.map((i) => (
              <div key={i.name} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/35">
                  {i.title ?? i.name}
                </p>
                <p className="text-lg font-bold text-ink tabular-nums mt-0.5">{i.value ?? "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            {insightsNote ?? "Insight metric not available for this media type."}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <SectionHeading
            title="Comments"
            icon={MessageCircle}
            iconClass="bg-violet-500/12 text-violet-300"
          />
          {comments.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onSummarizeComments}>
              <Reply size={13} /> Draft
            </Button>
          )}
        </div>
        <InstagramCommentsPanel
          comments={comments}
          loading={commentsLoading}
          error={commentsError}
          onDraftReply={onDraftReply}
        />
      </div>
    </div>
  );
}
