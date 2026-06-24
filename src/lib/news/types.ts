export interface NewsItem {
  category: string;
  title: string;
  source: string;
  time: string;
  url?: string;
  publishedAt?: string;
  live: boolean;
}

export interface NewsFetchResult {
  news: NewsItem[];
  live: boolean;
  error?: string;
}
