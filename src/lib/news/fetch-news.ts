import type { NewsFetchResult, NewsItem } from "./types";

const CACHE_TTL_MS = 20 * 60 * 1000;

/** Industry-focused sources for jewellery, watches, and metals. */
const TRUSTED_DOMAINS = [
  "jckonline.com",
  "nationaljeweler.com",
  "rapaport.com",
  "wwd.com",
  "robbreport.com",
  "hodinkee.com",
  "watchpro.com",
  "ablogtowatch.com",
  "jewels.com",
  "kitco.com",
  "mining.com",
  "reuters.com",
  "marketwatch.com",
  "forbes.com",
  "businessinsider.com",
  "bloomberg.com",
  "cnbc.com",
  "thediamondpress.com",
  "idexonline.com",
  "professionaljeweller.com",
].join(",");

const EXCLUDED_DOMAINS = [
  "southernsavers.com",
  "bossip.com",
  "commercialobserver.com",
  "kunerstler.com",
  "kunstler.com",
  "hackaday.com",
];

/** Titles matching these are almost never industry-relevant. */
const EXCLUDED_TITLE_PATTERNS = [
  /\bweekly ad\b/i,
  /\bkroger\b/i,
  /\bcoupon\b/i,
  /\bgift guide\b/i,
  /\boffice space\b/i,
  /\bsq\.?\s*ft\b/i,
  /\breal estate\b/i,
  /\bcontent creation platform\b/i,
  /\bcustom pcb\b/i,
  /\bamerican punk\b/i,
  /\bcoach's\b/i,
];

interface NewsCategoryConfig {
  category: string;
  query: string;
  /** Article title must match this to be accepted. */
  titleMatch: RegExp;
}

const NEWS_CATEGORIES: NewsCategoryConfig[] = [
  {
    category: "Gold",
    query: '("gold price" OR "gold prices" OR "gold futures" OR bullion OR "precious metals")',
    titleMatch: /\b(gold|bullion|precious metals?)\b/i,
  },
  {
    category: "Silver",
    query: '("silver price" OR "silver prices" OR "silver futures" OR "silver bullion")',
    titleMatch: /\bsilver\b/i,
  },
  {
    category: "Diamond",
    query: '(diamond AND (jewelry OR jewellery OR "diamond market" OR "diamond prices" OR "diamond industry"))',
    titleMatch: /\bdiamond/i,
  },
  {
    category: "Lab-Grown",
    query: '("lab-grown diamond" OR "lab grown diamond" OR "lab-grown diamonds")',
    titleMatch: /lab[- ]?grown/i,
  },
  {
    category: "Rolex",
    query: "Rolex",
    titleMatch: /\brolex\b/i,
  },
  {
    category: "Gucci",
    query: '(Gucci AND (watch OR watches OR jewellery OR jewelry OR timepiece))',
    titleMatch: /\bgucci\b/i,
  },
  {
    category: "Movado",
    query: '(Movado AND (watch OR watches OR timepiece OR "Movado Group"))',
    titleMatch: /\bmovado\b/i,
  },
  {
    category: "Rado",
    query: '(Rado AND (watch OR watches OR timepiece OR "Captain Cook"))',
    titleMatch: /\brado\b/i,
  },
  {
    category: "Bulova",
    query: '(Bulova AND (watch OR watches OR timepiece))',
    titleMatch: /\bbulova\b/i,
  },
  {
    category: "G-Shock",
    query: '("G-Shock" OR "G Shock" OR "Casio G-Shock")',
    titleMatch: /g-?\s*shock|casio g-?shock/i,
  },
];

interface NewsApiArticle {
  title?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
}

let cache: { result: NewsFetchResult; fetchedAt: number } | null = null;

function formatNewsTime(publishedAt?: string): string {
  if (!publishedAt) return "Recently";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cleanTitle(raw?: string): string {
  return raw?.replace(/\s*-\s*[^-]+$/, "").trim() ?? "";
}

function getHostname(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isExcludedArticle(title: string, url?: string): boolean {
  if (EXCLUDED_TITLE_PATTERNS.some((p) => p.test(title))) return true;
  const host = getHostname(url);
  if (host && EXCLUDED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return true;
  }
  return false;
}

function articleToNewsItem(category: string, article: NewsApiArticle): NewsItem | null {
  const title = cleanTitle(article.title);
  if (!title) return null;
  return {
    category,
    title,
    source: article.source?.name ?? "News",
    time: formatNewsTime(article.publishedAt),
    url: article.url,
    publishedAt: article.publishedAt,
    live: true,
  };
}

function pickRelevantArticle(
  articles: NewsApiArticle[],
  config: NewsCategoryConfig
): NewsApiArticle | null {
  for (const article of articles) {
    const title = cleanTitle(article.title);
    if (!title) continue;
    if (!config.titleMatch.test(title)) continue;
    if (isExcludedArticle(title, article.url)) continue;
    return article;
  }
  return null;
}

async function requestNewsApi(
  apiKey: string,
  query: string,
  options: { domains?: string; sortBy: "relevancy" | "publishedAt" }
): Promise<{ articles: NewsApiArticle[]; error?: string }> {
  const params = new URLSearchParams({
    q: query,
    language: "en",
    sortBy: options.sortBy,
    searchIn: "title",
    pageSize: "20",
    apiKey,
  });
  if (options.domains) {
    params.set("domains", options.domains);
  }

  const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json" },
  });

  const data = (await res.json()) as {
    status?: string;
    message?: string;
    articles?: NewsApiArticle[];
  };

  if (!res.ok || data.status === "error") {
    return { articles: [], error: data.message || `NewsAPI HTTP ${res.status}` };
  }

  return { articles: data.articles ?? [] };
}

async function fetchCategoryHeadline(
  apiKey: string,
  config: NewsCategoryConfig
): Promise<{ item: NewsItem | null; error?: string }> {
  const attempts: { domains?: string; sortBy: "relevancy" | "publishedAt" }[] = [
    { domains: TRUSTED_DOMAINS, sortBy: "relevancy" },
    { sortBy: "relevancy" },
    { domains: TRUSTED_DOMAINS, sortBy: "publishedAt" },
    { sortBy: "publishedAt" },
  ];

  let lastError: string | undefined;

  for (const attempt of attempts) {
    const { articles, error } = await requestNewsApi(apiKey, config.query, attempt);
    if (error) lastError = error;

    const match = pickRelevantArticle(articles, config);
    if (match) {
      const item = articleToNewsItem(config.category, match);
      if (item) return { item };
    }
  }

  return { item: null, error: lastError };
}

const FALLBACK_NEWS: NewsItem[] = [
  {
    category: "Gold",
    title: "Gold holds near record highs as central banks keep buying",
    source: "Industry briefing",
    time: "Today",
    live: false,
  },
  {
    category: "Silver",
    title: "Silver demand rises on industrial and jewellery consumption",
    source: "Industry briefing",
    time: "Yesterday",
    live: false,
  },
  {
    category: "Diamond",
    title: "Natural diamond market shows mixed demand across retail channels",
    source: "Industry briefing",
    time: "Today",
    live: false,
  },
  {
    category: "Lab-Grown",
    title: "Lab-grown diamond retail prices continue to soften year over year",
    source: "Industry briefing",
    time: "Today",
    live: false,
  },
  {
    category: "Rolex",
    title: "Rolex expands certified pre-owned program to more retailers",
    source: "Industry briefing",
    time: "1d ago",
    live: false,
  },
  {
    category: "Gucci",
    title: "Gucci unveils new fine jewellery and timepiece collection",
    source: "Industry briefing",
    time: "4d ago",
    live: false,
  },
  {
    category: "Movado",
    title: "Movado Group reports steady demand in luxury watch segment",
    source: "Industry briefing",
    time: "2d ago",
    live: false,
  },
  {
    category: "Rado",
    title: "Rado debuts new high-tech ceramic Captain Cook editions",
    source: "Industry briefing",
    time: "3d ago",
    live: false,
  },
  {
    category: "Bulova",
    title: "Bulova highlights heritage collections in latest watch lineup",
    source: "Industry briefing",
    time: "2d ago",
    live: false,
  },
  {
    category: "G-Shock",
    title: "G-Shock releases new rugged digital models for outdoor enthusiasts",
    source: "Industry briefing",
    time: "1d ago",
    live: false,
  },
];

const FALLBACK_BY_CATEGORY = new Map(FALLBACK_NEWS.map((n) => [n.category, n]));

export function isNewsApiConfigured(): boolean {
  const key = process.env.NEWS_API_KEY;
  return !!key && !key.includes("REPLACE");
}

export async function fetchLiveNews(force = false): Promise<NewsFetchResult> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.result;
  }

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return {
      news: FALLBACK_NEWS,
      live: false,
      error: "NEWS_API_KEY not configured",
    };
  }

  try {
    const results = await Promise.all(
      NEWS_CATEGORIES.map((config) =>
        fetchCategoryHeadline(apiKey, config).catch(
          (err): { item: NewsItem | null; error?: string } => ({
            item: null,
            error: err instanceof Error ? err.message : "Request failed",
          })
        )
      )
    );

    const apiErrors = [...new Set(results.map((r) => r.error).filter(Boolean))] as string[];
    let liveCount = 0;

    const news = NEWS_CATEGORIES.map((config, i) => {
      const live = results[i]?.item;
      if (live) {
        liveCount++;
        return live;
      }
      return FALLBACK_BY_CATEGORY.get(config.category) ?? {
        category: config.category,
        title: `No recent ${config.category} headline found`,
        source: "Industry briefing",
        time: "—",
        live: false,
      };
    });

    const result: NewsFetchResult = {
      news,
      live: liveCount > 0,
      error: liveCount === 0 ? apiErrors[0] ?? "No relevant articles from NewsAPI" : undefined,
    };

    cache = { result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    return {
      news: FALLBACK_NEWS,
      live: false,
      error: err instanceof Error ? err.message : "News fetch failed",
    };
  }
}
