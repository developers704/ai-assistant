import Parser from "rss-parser";
import type { NewsFetchResult, NewsItem } from "./types";

const CACHE_TTL_MS = 20 * 60 * 1000;
const FETCH_USER_AGENT = "LindyAI/1.0 (Valliani Executive Assistant; +https://ai-assistant.vallianiuniversity.com)";

type RssTopic = "sports" | "politics";

interface RssFeedConfig {
  url: string;
  source: string;
  /** Higher weight = more headlines kept from this feed (US-heavy politics). */
  maxItems?: number;
  region?: "US" | "World";
}

const SPORTS_FEEDS: RssFeedConfig[] = [
  { url: "https://www.espn.com/espn/rss/news", source: "ESPN", maxItems: 6 },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", source: "BBC Sport", maxItems: 6 },
  { url: "https://feeds.apnews.com/apf-sports", source: "AP Sports", maxItems: 5 },
];

/** US-heavy politics plus world coverage. */
const POLITICS_FEEDS: RssFeedConfig[] = [
  { url: "https://feeds.npr.org/1014/rss.xml", source: "NPR Politics", maxItems: 5, region: "US" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR News", maxItems: 4, region: "US" },
  { url: "https://feeds.apnews.com/apf-topnews", source: "AP News", maxItems: 5, region: "US" },
  {
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    source: "BBC US & Canada",
    maxItems: 4,
    region: "US",
  },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", maxItems: 4, region: "World" },
  { url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", source: "BBC Europe", maxItems: 3, region: "World" },
  { url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", source: "BBC Asia", maxItems: 3, region: "World" },
];

const FALLBACK_SPORTS: NewsItem[] = [
  {
    category: "Sports",
    title: "Major league and international sports coverage updates throughout the day",
    source: "Sports briefing",
    time: "Today",
    live: false,
  },
  {
    category: "Sports",
    title: "NFL, NBA, MLB, and college sports headlines from ESPN and AP",
    source: "Sports briefing",
    time: "Today",
    live: false,
  },
];

const FALLBACK_POLITICS: NewsItem[] = [
  {
    category: "US Politics",
    title: "US political developments from NPR and AP — Congress, White House, and policy",
    source: "Politics briefing",
    time: "Today",
    live: false,
  },
  {
    category: "World",
    title: "Global news from BBC World — diplomacy, conflicts, and international affairs",
    source: "Politics briefing",
    time: "Today",
    live: false,
  },
];

const parser = new Parser({
  timeout: 12_000,
  headers: { "User-Agent": FETCH_USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
});

const cache: Partial<Record<RssTopic, { result: NewsFetchResult; fetchedAt: number }>> = {};

function cleanTitle(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").replace(/<[^>]+>/g, "").trim();
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "Recently";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function politicsCategory(region?: "US" | "World"): string {
  return region === "World" ? "World" : "US Politics";
}

async function fetchSingleFeed(
  feed: RssFeedConfig,
  topic: RssTopic
): Promise<{ items: NewsItem[]; error?: string }> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const maxItems = feed.maxItems ?? 5;
    const items: NewsItem[] = [];

    for (const entry of parsed.items ?? []) {
      const title = cleanTitle(entry.title);
      if (!title || title.length < 12) continue;

      const url = entry.link || entry.guid;
      const publishedAt = entry.isoDate || entry.pubDate;
      const category =
        topic === "politics" ? politicsCategory(feed.region) : "Sports";

      items.push({
        category,
        title,
        source: feed.source,
        time: formatRelativeTime(publishedAt),
        url: typeof url === "string" ? url : undefined,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
        live: true,
      });

      if (items.length >= maxItems) break;
    }

    return { items };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "RSS fetch failed",
    };
  }
}

function mergeAndRank(items: NewsItem[], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const sorted = [...items].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  const merged: NewsItem[] = [];
  for (const item of sorted) {
    const key = normalizeKey(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

async function fetchRssTopic(topic: RssTopic, force = false): Promise<NewsFetchResult> {
  if (!force && cache[topic] && Date.now() - cache[topic]!.fetchedAt < CACHE_TTL_MS) {
    return cache[topic]!.result;
  }

  const feeds = topic === "sports" ? SPORTS_FEEDS : POLITICS_FEEDS;
  const limit = topic === "sports" ? 12 : 15;
  const fallback = topic === "sports" ? FALLBACK_SPORTS : FALLBACK_POLITICS;

  const results = await Promise.all(feeds.map((feed) => fetchSingleFeed(feed, topic)));
  const allItems = results.flatMap((r) => r.items);
  const errors = [...new Set(results.map((r) => r.error).filter(Boolean))] as string[];

  const news = mergeAndRank(allItems, limit);
  const liveCount = news.filter((n) => n.live).length;

  const result: NewsFetchResult = {
    news: liveCount > 0 ? news : fallback,
    live: liveCount > 0,
    error: liveCount === 0 ? errors[0] ?? "No RSS headlines available" : undefined,
  };

  cache[topic] = { result, fetchedAt: Date.now() };
  return result;
}

export function fetchRssSportsNews(force = false): Promise<NewsFetchResult> {
  return fetchRssTopic("sports", force);
}

export function fetchRssPoliticsNews(force = false): Promise<NewsFetchResult> {
  return fetchRssTopic("politics", force);
}
